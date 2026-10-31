CREATE TABLE IF NOT EXISTS arcade720_scores (
 id uuid PRIMARY KEY, initials varchar(3) NOT NULL,
 score bigint NOT NULL CHECK(score>0 AND score<=4294967295),
 skill varchar(12) NOT NULL CHECK(skill IN ('training','experienced')),
 version varchar(24) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arcade720_ranking ON arcade720_scores(skill, score DESC, created_at ASC);
