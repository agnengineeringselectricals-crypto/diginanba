-- DigiNanba user public IDs and signup country metadata.
-- Safe to run repeatedly. IDs are 8 characters: ISO-3166 alpha-2 country prefix + 6 base-36 characters.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS country_code CHAR(2) NOT NULL DEFAULT 'IN';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS public_id VARCHAR(8);

CREATE OR REPLACE FUNCTION public.diginanba_generate_public_id(p_country_code TEXT)
RETURNS VARCHAR(8)
LANGUAGE plpgsql
AS $$
DECLARE
  prefix TEXT := upper(left(trim(coalesce(p_country_code, 'IN')), 2));
  alphabet CONSTANT TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  candidate VARCHAR(8);
  suffix TEXT;
  i INTEGER;
  attempts INTEGER := 0;
BEGIN
  IF prefix !~ '^[A-Z]{2}$' THEN
    prefix := 'IN';
  END IF;
  LOOP
    suffix := '';
    FOR i IN 1..6 LOOP
      suffix := suffix || substr(alphabet, floor(random() * length(alphabet))::integer + 1, 1);
    END LOOP;
    candidate := prefix || suffix;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.users u WHERE u.public_id = candidate);
    attempts := attempts + 1;
    IF attempts >= 100 THEN
      RAISE EXCEPTION 'Unable to allocate unique DigiNanba public ID after % attempts', attempts;
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

UPDATE public.users
SET country_code = upper(left(trim(coalesce(country_code, 'IN')), 2))
WHERE country_code IS NULL OR country_code !~ '^[A-Z]{2}$';

UPDATE public.users u
SET public_id = public.diginanba_generate_public_id(u.country_code)
WHERE u.public_id IS NULL OR btrim(u.public_id) = '';

CREATE UNIQUE INDEX IF NOT EXISTS users_public_id_key ON public.users(public_id);

CREATE OR REPLACE FUNCTION public.diginanba_assign_public_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.country_code := upper(left(trim(coalesce(NEW.country_code, 'IN')), 2));
  IF NEW.country_code !~ '^[A-Z]{2}$' THEN
    NEW.country_code := 'IN';
  END IF;
  IF NEW.public_id IS NULL OR btrim(NEW.public_id) = '' THEN
    NEW.public_id := public.diginanba_generate_public_id(NEW.country_code);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_assign_public_id ON public.users;
CREATE TRIGGER users_assign_public_id
BEFORE INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.diginanba_assign_public_id();

ALTER TABLE public.users ALTER COLUMN public_id SET NOT NULL;
