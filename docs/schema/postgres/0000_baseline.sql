CREATE TABLE "attachments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "attachments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"attachable_type" text NOT NULL,
	"attachable_id" integer NOT NULL,
	"file_path" text NOT NULL,
	"file_type" text,
	"uploaded_by" integer NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"nama_asli" text DEFAULT '' NOT NULL,
	"ukuran_bytes" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "holidays_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nama" text NOT NULL,
	"tanggal_mulai" date NOT NULL,
	"tanggal_akhir" date NOT NULL,
	CONSTRAINT "holidays_rentang" CHECK ("holidays"."tanggal_akhir" >= "holidays"."tanggal_mulai")
);
--> statement-breakpoint
CREATE TABLE "kendala" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "kendala_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"task_log_id" integer NOT NULL,
	"deskripsi" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kendala_status" CHECK ("kendala"."status" IN ('open', 'resolved'))
);
--> statement-breakpoint
CREATE TABLE "laporan_template" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"file_path" text NOT NULL,
	"nama_asli" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaves" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leaves_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"tanggal" date NOT NULL,
	"jenis" text NOT NULL,
	"alasan" text,
	"potong_cuti_tahunan" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leaves_jenis" CHECK ("leaves"."jenis" IN ('cuti', 'sakit', 'izin'))
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "projects_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nama" text NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"belum_direkonsiliasi" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "projects_is_active_flag" CHECK ("projects"."is_active" IN (0, 1)),
	CONSTRAINT "projects_belum_direkonsiliasi_flag" CHECK ("projects"."belum_direkonsiliasi" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE "saran_bulanan" (
	"user_id" integer NOT NULL,
	"bulan" text NOT NULL,
	"isi" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saran_bulanan_user_id_bulan_pk" PRIMARY KEY("user_id","bulan")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"token_hash" text NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "task_log_commits" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "task_log_commits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"task_log_id" integer NOT NULL,
	"commit_sha" text NOT NULL,
	"commit_url" text NOT NULL,
	"pesan" text NOT NULL,
	"authored_at" timestamp with time zone NOT NULL,
	"ditambahkan_oleh" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_log_commits_ditambahkan_oleh_commit_sha_unique" UNIQUE("ditambahkan_oleh","commit_sha")
);
--> statement-breakpoint
CREATE TABLE "task_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "task_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"task_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"tanggal" date NOT NULL,
	"jenis" text NOT NULL,
	"catatan" text,
	"is_extra" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_logs_jenis" CHECK ("task_logs"."jenis" IN ('rencana', 'realisasi')),
	CONSTRAINT "task_logs_is_extra_flag" CHECK ("task_logs"."is_extra" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"project_id" integer NOT NULL,
	"deskripsi" text NOT NULL,
	"tag" text,
	"status" text DEFAULT 'open' NOT NULL,
	"deskripsi_penutupan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_status" CHECK ("tasks"."status" IN ('open', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "user_project" (
	"user_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "user_project_user_id_project_id_pk" PRIMARY KEY("user_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" integer NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role"),
	CONSTRAINT "user_roles_role" CHECK ("user_roles"."role" IN ('tenaga_ahli', 'supervisi', 'atasan', 'admin'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nama" text NOT NULL,
	"email" text,
	"password_hash" text,
	"atasan_id" integer,
	"supervisi_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"gitlab_username" text,
	"gitlab_avatar_url" text,
	"gitlab_private_token" text,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_atasan_bukan_diri_sendiri" CHECK ("users"."atasan_id" IS NULL OR "users"."atasan_id" <> "users"."id"),
	CONSTRAINT "users_supervisi_bukan_diri_sendiri" CHECK ("users"."supervisi_id" IS NULL OR "users"."supervisi_id" <> "users"."id")
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kendala" ADD CONSTRAINT "kendala_task_log_id_task_logs_id_fk" FOREIGN KEY ("task_log_id") REFERENCES "public"."task_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laporan_template" ADD CONSTRAINT "laporan_template_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saran_bulanan" ADD CONSTRAINT "saran_bulanan_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_log_commits" ADD CONSTRAINT "task_log_commits_task_log_id_task_logs_id_fk" FOREIGN KEY ("task_log_id") REFERENCES "public"."task_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_log_commits" ADD CONSTRAINT "task_log_commits_ditambahkan_oleh_users_id_fk" FOREIGN KEY ("ditambahkan_oleh") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_logs" ADD CONSTRAINT "task_logs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_logs" ADD CONSTRAINT "task_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_project" ADD CONSTRAINT "user_project_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_project" ADD CONSTRAINT "user_project_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_atasan_id_users_id_fk" FOREIGN KEY ("atasan_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_supervisi_id_users_id_fk" FOREIGN KEY ("supervisi_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attachments_morph" ON "attachments" USING btree ("attachable_type","attachable_id");--> statement-breakpoint
CREATE INDEX "idx_holidays_rentang" ON "holidays" USING btree ("tanggal_mulai","tanggal_akhir");--> statement-breakpoint
CREATE INDEX "idx_leaves_user_tanggal" ON "leaves" USING btree ("user_id","tanggal");--> statement-breakpoint
CREATE INDEX "idx_task_log_commits_task_log" ON "task_log_commits" USING btree ("task_log_id");--> statement-breakpoint
CREATE INDEX "idx_task_logs_user_tanggal" ON "task_logs" USING btree ("user_id","tanggal","jenis");--> statement-breakpoint
CREATE INDEX "idx_task_logs_task" ON "task_logs" USING btree ("task_id");