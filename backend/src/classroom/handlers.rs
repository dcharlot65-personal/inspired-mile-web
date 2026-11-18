use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use rand::RngExt;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

use crate::auth::Claims;
use crate::config::Config;

#[derive(Serialize)]
pub struct Classroom {
    pub id: i32,
    pub name: String,
    pub join_code: String,
    pub member_count: i64,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateClassroomRequest {
    pub name: String,
}

#[derive(Serialize)]
pub struct ClassroomMember {
    pub user_id: String,
    pub username: String,
    pub role: String,
    pub joined_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct JoinClassroomRequest {
    pub code: String,
}

#[derive(Deserialize)]
pub struct CreateAssignmentRequest {
    pub title: String,
    pub assignment_type: String,
}

#[derive(Serialize)]
pub struct Assignment {
    pub id: i32,
    pub title: String,
    pub assignment_type: String,
    pub created_at: DateTime<Utc>,
}

fn generate_join_code() -> String {
    let mut rng = rand::rng();
    let chars: Vec<char> = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".chars().collect();
    (0..6).map(|_| chars[rng.random_range(0..chars.len())]).collect()
}

pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/", get(list_classrooms).post(create_classroom))
        .route("/{id}/members", get(list_members))
        .route("/join", post(join_classroom))
        .route("/{id}/assignments", get(list_assignments).post(create_assignment))
}

async fn create_classroom(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<CreateClassroomRequest>,
) -> Result<Json<Classroom>, (StatusCode, String)> {
    if body.name.is_empty() || body.name.len() > 128 {
        return Err((StatusCode::BAD_REQUEST, "Name must be 1-128 characters".into()));
    }

    let code = generate_join_code();

    let row = sqlx::query(
        "INSERT INTO classrooms (teacher_id, name, join_code)
         VALUES ($1, $2, $3)
         RETURNING id, name, join_code, created_at",
    )
    .bind(claims.sub)
    .bind(&body.name)
    .bind(&code)
    .fetch_one(&pool)
    .await
    .map_err(crate::error::internal)?;

    // Add teacher as a member
    let classroom_id: i32 = row.get("id");
    sqlx::query(
        "INSERT INTO classroom_members (classroom_id, user_id, role) VALUES ($1, $2, 'teacher')",
    )
    .bind(classroom_id)
    .bind(claims.sub)
    .execute(&pool)
    .await
    .ok();

    Ok(Json(Classroom {
        id: classroom_id,
        name: row.get("name"),
        join_code: row.get("join_code"),
        member_count: 1,
        created_at: row.get("created_at"),
    }))
}

async fn list_classrooms(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<Vec<Classroom>>, (StatusCode, String)> {
    let rows = sqlx::query(
        "SELECT c.id, c.name, c.join_code, c.created_at,
                COUNT(cm.id) as member_count
         FROM classrooms c
         JOIN classroom_members cm ON cm.classroom_id = c.id
         WHERE c.id IN (SELECT classroom_id FROM classroom_members WHERE user_id = $1)
         AND c.active = TRUE
         GROUP BY c.id
         ORDER BY c.created_at DESC",
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await
    .map_err(crate::error::internal)?;

    let classrooms: Vec<Classroom> = rows
        .iter()
        .map(|r| Classroom {
            id: r.get("id"),
            name: r.get("name"),
            join_code: r.get("join_code"),
            member_count: r.get("member_count"),
            created_at: r.get("created_at"),
        })
        .collect();

    Ok(Json(classrooms))
}

async fn join_classroom(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<JoinClassroomRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let code = body.code.trim().to_uppercase();
    if code.len() != 6 {
        return Err((StatusCode::BAD_REQUEST, "Invalid join code".into()));
    }

    let classroom = sqlx::query("SELECT id, name FROM classrooms WHERE join_code = $1 AND active = TRUE")
        .bind(&code)
        .fetch_optional(&pool)
        .await
        .map_err(crate::error::internal)?
        .ok_or((StatusCode::NOT_FOUND, "Classroom not found".into()))?;

    let classroom_id: i32 = classroom.get("id");
    let name: String = classroom.get("name");

    sqlx::query(
        "INSERT INTO classroom_members (classroom_id, user_id, role)
         VALUES ($1, $2, 'student')
         ON CONFLICT (classroom_id, user_id) DO NOTHING",
    )
    .bind(classroom_id)
    .bind(claims.sub)
    .execute(&pool)
    .await
    .map_err(crate::error::internal)?;

    Ok(Json(serde_json::json!({ "joined": true, "classroom": name })))
}

/// A classroom's roster and assignments are for the people in it: its teacher and its
/// members. Classroom ids are small sequential numbers, so without this check any signed-in
/// account could read every class's roster by counting up.
///
/// The same answer is given for a classroom that does not exist and for one the caller is
/// not in, so the ids that are in use cannot be told apart either.
async fn require_membership(
    pool: &PgPool,
    classroom_id: i32,
    user_id: uuid::Uuid,
) -> Result<(), (StatusCode, String)> {
    let allowed: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM classroom_members WHERE classroom_id = $1 AND user_id = $2)
             OR EXISTS(SELECT 1 FROM classrooms WHERE id = $1 AND teacher_id = $2)",
    )
    .bind(classroom_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(crate::error::internal)?;
    if allowed {
        Ok(())
    } else {
        Err((StatusCode::FORBIDDEN, "Not a member of this classroom".into()))
    }
}

async fn list_members(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Path(classroom_id): Path<i32>,
) -> Result<Json<Vec<ClassroomMember>>, (StatusCode, String)> {
    require_membership(&pool, classroom_id, claims.sub).await?;
    let rows = sqlx::query(
        "SELECT u.id, u.username, cm.role, cm.joined_at
         FROM classroom_members cm
         JOIN users u ON u.id = cm.user_id
         WHERE cm.classroom_id = $1
         ORDER BY cm.role, cm.joined_at",
    )
    .bind(classroom_id)
    .fetch_all(&pool)
    .await
    .map_err(crate::error::internal)?;

    let members: Vec<ClassroomMember> = rows
        .iter()
        .map(|r| {
            let id: uuid::Uuid = r.get("id");
            ClassroomMember {
                user_id: id.to_string(),
                username: r.get("username"),
                role: r.get("role"),
                joined_at: r.get("joined_at"),
            }
        })
        .collect();

    Ok(Json(members))
}

async fn list_assignments(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Path(classroom_id): Path<i32>,
) -> Result<Json<Vec<Assignment>>, (StatusCode, String)> {
    require_membership(&pool, classroom_id, claims.sub).await?;
    let rows = sqlx::query(
        "SELECT id, title, assignment_type, created_at
         FROM classroom_assignments WHERE classroom_id = $1
         ORDER BY created_at DESC",
    )
    .bind(classroom_id)
    .fetch_all(&pool)
    .await
    .map_err(crate::error::internal)?;

    let assignments: Vec<Assignment> = rows
        .iter()
        .map(|r| Assignment {
            id: r.get("id"),
            title: r.get("title"),
            assignment_type: r.get("assignment_type"),
            created_at: r.get("created_at"),
        })
        .collect();

    Ok(Json(assignments))
}

async fn create_assignment(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Path(classroom_id): Path<i32>,
    Json(body): Json<CreateAssignmentRequest>,
) -> Result<Json<Assignment>, (StatusCode, String)> {
    if body.title.is_empty() || body.title.len() > 128 {
        return Err((StatusCode::BAD_REQUEST, "Title must be 1-128 characters".into()));
    }

    // Verify caller is the teacher
    let member = sqlx::query(
        "SELECT role FROM classroom_members WHERE classroom_id = $1 AND user_id = $2",
    )
    .bind(classroom_id)
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await
    .map_err(crate::error::internal)?
    .ok_or((StatusCode::FORBIDDEN, "Not a member of this classroom".into()))?;

    let role: String = member.get("role");
    if role != "teacher" {
        return Err((StatusCode::FORBIDDEN, "Only teachers can create assignments".into()));
    }

    let row = sqlx::query(
        "INSERT INTO classroom_assignments (classroom_id, title, assignment_type)
         VALUES ($1, $2, $3)
         RETURNING id, title, assignment_type, created_at",
    )
    .bind(classroom_id)
    .bind(&body.title)
    .bind(&body.assignment_type)
    .fetch_one(&pool)
    .await
    .map_err(crate::error::internal)?;

    Ok(Json(Assignment {
        id: row.get("id"),
        title: row.get("title"),
        assignment_type: row.get("assignment_type"),
        created_at: row.get("created_at"),
    }))
}
