DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "BackgroundOption" WHERE "isDefault" = true) > 1 THEN
    RAISE EXCEPTION 'Cannot enforce the single-default background rule while multiple default backgrounds exist; reconcile those rows before retrying this migration.';
  END IF;
END
$$;

CREATE UNIQUE INDEX "BackgroundOption_single_default_idx"
ON "BackgroundOption" ("isDefault")
WHERE "isDefault" = true;
