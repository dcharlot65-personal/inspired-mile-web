-- Classroom Mode: Teachers create classes, students join via code
CREATE TABLE IF NOT EXISTS classrooms (
    id SERIAL PRIMARY KEY,
    teacher_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(128) NOT NULL,
    join_code VARCHAR(8) NOT NULL UNIQUE,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS classroom_members (
    id SERIAL PRIMARY KEY,
    classroom_id INT NOT NULL REFERENCES classrooms(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(16) NOT NULL DEFAULT 'student', -- 'teacher' or 'student'
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(classroom_id, user_id)
);

CREATE TABLE IF NOT EXISTS classroom_assignments (
    id SERIAL PRIMARY KEY,
    classroom_id INT NOT NULL REFERENCES classrooms(id),
    title VARCHAR(128) NOT NULL,
    assignment_type VARCHAR(32) NOT NULL, -- 'trivia', 'challenge', 'battle'
    settings JSONB NOT NULL DEFAULT '{}',
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classrooms_teacher ON classrooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_code ON classrooms(join_code);
CREATE INDEX IF NOT EXISTS idx_classroom_members_user ON classroom_members(user_id);
