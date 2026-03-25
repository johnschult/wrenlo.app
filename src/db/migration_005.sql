ALTER TABLE businesses ADD COLUMN system_prompt_es TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN example_questions_es TEXT NOT NULL DEFAULT '[]';
