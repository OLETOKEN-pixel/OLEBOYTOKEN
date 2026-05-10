CREATE OR REPLACE FUNCTION public.sanitize_shop_item_copy_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.description := '';
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_shop_slot_presentation_copy_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.supporting_text := '';
  NEW.show_supporting_text := false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sanitize_shop_items_copy_fields ON public.shop_items;
CREATE TRIGGER sanitize_shop_items_copy_fields
BEFORE INSERT OR UPDATE ON public.shop_items
FOR EACH ROW
EXECUTE FUNCTION public.sanitize_shop_item_copy_fields();

DROP TRIGGER IF EXISTS sanitize_shop_draft_items_copy_fields ON public.shop_draft_items;
CREATE TRIGGER sanitize_shop_draft_items_copy_fields
BEFORE INSERT OR UPDATE ON public.shop_draft_items
FOR EACH ROW
EXECUTE FUNCTION public.sanitize_shop_item_copy_fields();

DROP TRIGGER IF EXISTS sanitize_shop_slot_presentations_copy_fields ON public.shop_slot_presentations;
CREATE TRIGGER sanitize_shop_slot_presentations_copy_fields
BEFORE INSERT OR UPDATE ON public.shop_slot_presentations
FOR EACH ROW
EXECUTE FUNCTION public.sanitize_shop_slot_presentation_copy_fields();

UPDATE public.shop_items
SET
  description = '',
  updated_at = now()
WHERE description <> '';

UPDATE public.shop_draft_items
SET
  description = '',
  updated_at = now()
WHERE description <> '';

UPDATE public.shop_slot_presentations
SET
  supporting_text = '',
  show_supporting_text = false,
  updated_at = now()
WHERE supporting_text <> ''
   OR show_supporting_text = true;
