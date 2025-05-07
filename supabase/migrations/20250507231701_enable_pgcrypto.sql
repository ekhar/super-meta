-- Enable the pgcrypto extension for cryptographic functions
create extension if not exists "pgcrypto" with schema "extensions";
grant usage on schema extensions to public;
grant execute on all functions in schema extensions to public;
