-- Life Through the Ages: historical and scientific claims get their own review pathway, separate from the
-- scholarly (religious) review. The enum value is added in its own migration: PostgreSQL cannot use a new enum
-- value in the transaction that adds it (as in 20261031001150_roles.sql).
alter type public.app_role add value if not exists 'science_reviewer';
