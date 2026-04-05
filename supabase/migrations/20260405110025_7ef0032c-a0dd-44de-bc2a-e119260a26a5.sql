
INSERT INTO storage.buckets (id, name, public)
VALUES ('cv-uploads', 'cv-uploads', false);

CREATE POLICY "Users can upload their own CV"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'cv-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own CV"
ON storage.objects FOR SELECT
USING (bucket_id = 'cv-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own CV"
ON storage.objects FOR DELETE
USING (bucket_id = 'cv-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
