-- ADR-0047 (status token, 2026-09-19): arah produksi token GitLab per user, bukan cuma token
-- instance bersama di server/.env. gitlab_private_token dibaca duluan sebelum fallback ke env
-- var; gitlab_username/gitlab_avatar_url murni informasi tampilan (hasil GET /api/v4/user
-- pakai token itu sendiri), belum dipakai buat penyaringan commit (penyaringan tetap lewat
-- author_email vs users.email).
ALTER TABLE users ADD COLUMN gitlab_username TEXT;
ALTER TABLE users ADD COLUMN gitlab_avatar_url TEXT;
ALTER TABLE users ADD COLUMN gitlab_private_token TEXT;
