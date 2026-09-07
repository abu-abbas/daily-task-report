-- ADR-0042: usulan project via "Lainnya" pada input harian, menunggu rekonsiliasi admin
-- (dikonfirmasi jadi project resmi, atau digabung ke project existing).
ALTER TABLE projects ADD COLUMN belum_direkonsiliasi INTEGER NOT NULL DEFAULT 0;
