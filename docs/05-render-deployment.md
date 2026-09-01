# Phase 7 - Render deployment

`render.yaml` is the deployment source of truth. It creates a free PostgreSQL
database, Fastify API, and Next.js web application in Singapore.

## Create the Blueprint

1. Merge the PR that adds `render.yaml` to `main`.
2. In the Render Dashboard, select **New > Blueprint**.
3. Choose `48124812/dental-clinic`, set branch to `main`, and keep the default
   Blueprint path: `render.yaml`.
4. Review the three resources and select **Apply**.
5. Wait for the API, web service, and database to show **Live**.

## Verify

Open the URL shown for `dental-clinic-web`, then verify:

```text
https://<dental-clinic-api>.onrender.com/health
https://<dental-clinic-api>.onrender.com/ready
```

The API runs `prisma migrate deploy` before starting because Render's
pre-deploy command is a paid feature. The Blueprint uses `/bin/sh -c` so the
migration and Fastify startup run as two sequential commands.

## Continuous deployment

Both services automatically rebuild and deploy after a commit reaches `main`.
GitHub Actions remains the CI gate before merging.

## Free-plan caveats

Free web services spin down after idle time. The free PostgreSQL instance
expires after 30 days and has no backups. Treat this as a portfolio demo.
