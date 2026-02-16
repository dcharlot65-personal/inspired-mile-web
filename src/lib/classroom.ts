/**
 * Classroom Mode — Client-side API for teacher/student classroom operations.
 */

const API = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3849/api/v1';

export interface Classroom {
  id: number;
  name: string;
  join_code: string;
  member_count: number;
  created_at: string;
}

export interface ClassroomMember {
  user_id: string;
  username: string;
  role: 'teacher' | 'student';
  joined_at: string;
}

export interface Assignment {
  id: number;
  title: string;
  assignment_type: string;
  created_at: string;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export async function createClassroom(name: string): Promise<Classroom> {
  return apiFetch('/classroom', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function listClassrooms(): Promise<Classroom[]> {
  return apiFetch('/classroom');
}

export async function joinClassroom(code: string): Promise<{ joined: boolean; classroom: string }> {
  return apiFetch('/classroom/join', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function listMembers(classroomId: number): Promise<ClassroomMember[]> {
  return apiFetch(`/classroom/${classroomId}/members`);
}

export async function listAssignments(classroomId: number): Promise<Assignment[]> {
  return apiFetch(`/classroom/${classroomId}/assignments`);
}

export async function createAssignment(
  classroomId: number,
  title: string,
  assignmentType: string,
): Promise<Assignment> {
  return apiFetch(`/classroom/${classroomId}/assignments`, {
    method: 'POST',
    body: JSON.stringify({ title, assignment_type: assignmentType }),
  });
}
