/*
  Every minute: if the email queue has due messages, call process-notifications.

  Needs two Vault secrets (created once, outside git):
    project_url         https://<ref>.supabase.co
    outbox_cron_secret  same value as the edge function secret OUTBOX_CRON_SECRET
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule(j.jobid) FROM cron.job j WHERE j.jobname = 'process-notifications';

SELECT cron.schedule(
  'process-notifications',
  '* * * * *',
  $job$
  SELECT net.http_post(
    url := (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.name = 'project_url') || '/functions/v1/process-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.name = 'outbox_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  WHERE EXISTS (
    SELECT 1 FROM private.notification_outbox o
    WHERE o.send_after <= now()
      AND (o.status = 'pending' OR (o.status = 'sending' AND o.locked_at < now() - interval '10 minutes'))
  );
  $job$
);
