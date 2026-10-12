# Hosting this API: AWS, Azure, Locaweb, and Firestore

Audit notes for the NestJS + Prisma + PostgreSQL backend in this repo. Prices were checked on **11 October 2026**. List prices change, and São Paulo is more expensive than US East on AWS and Azure. Re-check the linked pricing pages before buying.

This file answers three questions:

1. Can the API run as an app platform and PostgreSQL as a managed database?
2. Can one demo month stay on a free tier: one clinic, 200 tutors, one day of use?
3. Can the database be replaced by Cloud Firestore?

## Short answers

| Question | Answer |
| --- | --- |
| API as an app, PostgreSQL as a managed database | Yes on Azure. Yes on AWS if you accept a container or Elastic Beanstalk. No on Locaweb: their managed database product is SQL Server, and Node.js runs on a virtual machine you administer. |
| Free for this demo | Yes for the data and the requests. The demo is one clinic and 200 tutors on one day, then no further use, with the API left running for the rest of the month. See [Demo day: one clinic, 200 tutors](#demo-day-one-clinic-200-tutors). |
| Firestore instead of PostgreSQL | Possible only as a rewrite. It does not remove the need to host this NestJS process unless the mobile app talks to Firestore directly. This demo fits the free Firestore quotas. A busy multi-clinic dashboard would not. |

The smallest comfortable production shape for this code, without a rewrite, is about **USD 25–47 per month** after free periods end. Locaweb’s equivalent is a virtual machine at about **R$ 45–80 per month**, with PostgreSQL installed on that machine.

## What this app actually needs

From `package.json`, `prisma/schema.prisma`, `src/main.ts`, and `src/prisma/prisma.service.ts`:

- A long-running Node.js process (`nest start` / `node dist/main`). It listens on `PORT`, default `3003`.
- PostgreSQL, reached with `DATABASE_URL` through Prisma 7 and the `pg` driver.
- Firebase Admin, already used only to verify ID tokens (`src/auth/firebase.ts`). The project id in `handoff.md` is `veti-5a61d`.
- Relational features the current code depends on: foreign keys, `onDelete: Cascade`, a unique pair `(userId, document)` on tutors, multi-row transactions in `src/owner/owner.service.ts`, a date-range read of appointments in `src/dashboard/dashboard.service.ts`, a `String[]` prescription, and a JSON `exams` field.
- No Dockerfile in the repo. A container host needs one to be added. A Node app platform (Azure App Service or Elastic Beanstalk) can run `npm run build` and `npm run start:prod` from source.

A vet is a Firebase user (`User.id` is the Firebase uid). Tutors are `Owner` rows and do not log in. The demo is **one clinic and 200 tutors**. The dollar floors later in this file are what that one server costs if it stays on for the month. They do not grow with the tutor count at this size.

## Demo day: one clinic, 200 tutors

The API stays deployed for one month (730 hours) and is then deleted. On one day, a single vet creates 200 tutors. After that day there is no client traffic.

`POST /owner` is what “introducing a tutor” does (`OwnerService.create`). The schema requires at least one pet on that request (`createOwnerSchema`). A uniqueness check runs on `(userId, document)` before the insert. Nothing in `create` reads `saasTutorQuota`, so the API will accept the 200th tutor. The starter catalog goes up to 300 tutors. The row created at first login still stores `saasTutorQuota = 100`, and the dashboard fee uses that stored number, not the live tutor count.

### Traffic and data for the month

Assumption for the table: 200 tutors, one pet each, no care plans and no appointments. The vet signs in once.

| Meter | Demo day | Other 29 days | Month total |
| --- | --- | --- | --- |
| Firebase monthly active users | 1 (the vet) | 0 | 1 |
| API calls to create the tutors | 200 | 0 | 200 |
| PostgreSQL rows | 200 `Owner` + 200 `Pet` | no new rows | 400 rows, a few hundred KB |
| Extra `GET /owner` calls | 1, if React Query keeps the list fresh while tutors are created. Up to 10 only if the list query is invalidated or refetched on each visit. | 0 | 1 to 10 |
| Firestore writes, tutor and pet as separate documents | 400 | 0 | 400 |
| Firestore reads for the tutor list | 400 for one full read (200 tutors + 200 pets). About 4,000 if that list is refetched 10 times. | 0 | 400 to 4,000 |

CPU for 200 creates is about a minute. At a pessimistic 500 ms of CPU per create, that is 100 seconds, about 2 of the 60 CPU minutes on Azure’s free app plan. Health checks every 30 seconds for the whole month add about 15 seconds of CPU per day.

The meter that actually gets used up is **hours the server is left running**. The 200 tutors do not move it.

The client already caches with React Query. That is the only cache this demo needs. `GET /owner` returns the whole clinic list in one response, and 200 tutors plus their pets is a small payload. A second cache (Redis, HTTP cache, or a CDN in front of the API) would not change the hosting tier. It can also serve a stale tutor list while the demo is creating rows, because those responses depend on the logged-in vet and change on every create.

React Query still calls the API when a query is invalidated or when it refetches a stale query (the default `staleTime` is 0, so a remount or window focus can refetch). After each `POST /owner`, write the new tutor into the list cache, or invalidate once at the end of the batch. Invalidating after every tutor refetches all 200 rows each time. That pattern is still cheap on PostgreSQL: 200 list calls, each one query. On Firestore it is the harsh case, 1 + 2 + … + 200 = 20,100 tutor reads, and the same again if each pet is its own document, 40,200 reads against a cap of 50,000.

Attaching a year-long care plan to all 200 pets on that same day is a different demo. `createPlan` writes on the order of 150 appointment rows per pet. Two hundred of those is about 30,000 writes, over Firestore’s free 20,000 writes/day. Sign-in and tutor creation do not do that.

### How much of each allowance this month uses

| Allowance | What you get | This month uses | Fits? |
| --- | --- | --- | --- |
| Azure Database for PostgreSQL, new account, 12 months | 750 hours/month of Burstable B1ms, 32 GB storage, 32 GB backup | 730 hours (97% of the hours) and a few hundred KB (about 0% of the 32 GB) | Yes, one server, one month. A 31-day month is 744 hours, still under 750. A second database in the same month would not fit. |
| Azure App Service F1 | USD 0, 60 CPU minutes per day, 1 GB RAM. Not a production SLA. | About 2 CPU minutes on the demo day, plus about 15 seconds per day from health checks | Yes. The limit that matters is Microsoft’s “not for production” rule, not the 200 tutors. |
| Azure App Service Linux B1, Brazil South | No free hours. USD 0.020/hour | 730 × 0.020 = **USD 14.60** for the month, including the 29 idle days | The database can be free. This app plan is not. |
| AWS RDS free plan, new account, up to 6 months | `db.t3.micro` or `db.t4g.micro`, 750 hours/month | 730 hours of one micro instance | Yes for the month. PostgreSQL is one of the free-plan engines. |
| AWS credits, new account | Up to USD 200, usable for up to 12 months | Lightsail Micro container USD 10 + database USD 15 = **USD 25** (12.5% of USD 200). The USD 15 database’s first month is free for new Lightsail customers, so the first month can be **USD 10**. | Yes. Deleting both at the end of the month stops the bill. Lightsail keeps charging a stopped database until it is deleted. |
| Firestore Spark reads | 50,000 documents/day | About 400 if React Query keeps one list response (under 1%). About 40,200 only if the list is refetched after every tutor and each pet is its own document (80%). | Yes for this demo. Then 0. |
| Firestore Spark writes | 20,000/day | 400 (2%) | Yes, unless every pet also gets a full care plan that day |
| Firestore Spark storage | 1 GiB | a few hundred KB | Yes |
| Firebase Auth | 50,000 monthly active users for email and social sign-in | 1 | Yes. Tutors are not accounts. |
| Locaweb Cloud | No free hours on the price table | One Small VM at the monthly cap is **R$ 40**, plus a public IP at **R$ 5**, for **R$ 45** even with no traffic after the demo | There is no allowance to stay inside. |

Leave the smallest PostgreSQL instance up for the month and it still fits the Azure and AWS hour allowances, because those allowances are 750 hours and a month is about 730. Delete the servers when the month ends. An idle Lightsail database keeps billing until it is deleted.

## AWS

### App plus managed PostgreSQL: yes, with a catch on App Runner

**App Runner is closed to new customers.** AWS stopped accepting new App Runner customers on 30 April 2026. Existing customers can keep using it. AWS points new apps at Amazon ECS Express Mode. Express Mode has no extra fee; you pay for the Fargate task, the Application Load Balancer, logs, data transfer, and public IPv4 addresses it creates. It also requires a container image. This repo does not have a Dockerfile yet.

Sources:

- https://aws.amazon.com/apprunner/ (end-of-support notice on the product page)
- https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html
- https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-overview.html
- https://aws.amazon.com/blogs/aws/build-production-ready-applications-without-infrastructure-complexity-using-amazon-ecs-express-mode/ (available in all commercial regions at launch, including a later CLI correction dated 17 June 2026)

App Runner’s own price page is still published, for accounts that already have it. In US East, Ohio, Oregon, and Ireland the idle charge is **USD 0.007 per GB-hour** of provisioned memory, and active compute is **USD 0.064 per vCPU-hour**. São Paulo is not an App Runner region. The endpoint list is US East (Ohio and N. Virginia), US West (Oregon), Mumbai, Singapore, Sydney, Tokyo, Frankfurt, Ireland, London, and Paris.

Source: https://aws.amazon.com/apprunner/pricing/ and https://docs.aws.amazon.com/general/latest/gr/apprunner.html

### Simplest AWS shape that is still an app plus a database

Two options that a new account can actually open.

**1. Lightsail, in São Paulo.** Lightsail has been in `sa-east-1` since 12 June 2026, including managed databases and container services, at the same published plan prices.

- Container service, one node: Nano is **USD 7/month** (0.25 shared vCPU, 512 MB). Micro is **USD 10/month** (0.25 shared vCPU, 1 GB). Each service includes 500 GB of transfer; extra egress starts at USD 0.09/GB and varies by region.
- Managed PostgreSQL, standard plan: **USD 15/month** for 1 GB RAM, 40 GB SSD, and 100 GB of transfer. High availability is twice that. New Lightsail customers get one month of the USD 15 plan free. The database keeps billing until it is deleted, including while stopped.
- A load balancer is **USD 18/month** and is unnecessary for one clinic on a demo day. The container service already has a URL and HTTPS.

Comfortable pair: Micro container + standard database = **USD 25/month**. Nano + database is USD 22/month and is tight for NestJS.

This is the simplest AWS bill. The container service is the app platform. The managed database is the database platform. You add a Dockerfile, set `DATABASE_URL` and `PORT`, and run `prisma migrate deploy` in the release step.

Sources:

- https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-lightsail-aws-regions/
- https://docs.aws.amazon.com/general/latest/gr/lightsail.html (São Paulo endpoint, database quota)
- https://aws.amazon.com/lightsail/pricing/
- https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-containers.html
- https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-frequently-asked-questions-faq-billing-and-account-management.html

**2. Elastic Beanstalk + Amazon RDS for PostgreSQL.** Beanstalk is the Node platform that does not need a Dockerfile. The Beanstalk orchestration layer has no separate fee; you pay for the EC2 instance, the load balancer if you add one, and RDS. A single-instance environment can skip the load balancer.

RDS for a new account is covered by the current free plan on `db.t3.micro` and `db.t4g.micro` for MySQL, PostgreSQL, MariaDB, and SQL Server Express, for up to 6 months, inside the account’s free-plan rules. After 15 July 2025, new accounts get up to USD 100 in credits at signup and up to USD 100 more (USD 200 total), valid for up to 12 months. The older “750 hours and 20 GB for 12 months” offer applies only to accounts that started the free tier before 15 July 2025.

A third-party price card (Holori, updated 11 October 2026) lists `db.t4g.micro` at **USD 0.016/hour, about USD 11.68/month**, in `us-east-1`. That card’s spec block says MariaDB. Use it as a ballpark and confirm the PostgreSQL row in the AWS Pricing Calculator before you treat it as a quote. Storage, backups, and São Paulo rates are extra. São Paulo is typically much higher than N. Virginia.

Sources:

- https://aws.amazon.com/rds/free/
- https://aws.amazon.com/rds/postgresql/pricing/
- https://calculator.holori.com/aws/rds/db.t4g.micro

**3. ECS Express Mode + RDS**, if you want the path AWS now recommends. Express Mode itself costs USD 0. You pay Fargate, an Application Load Balancer, CloudWatch, and data transfer.

Official Fargate Linux/x86 rates used in AWS’s own US East (N. Virginia) examples:

- USD 0.000011244 per vCPU-second
- USD 0.000001235 per GB-second

Always on for 730 hours (2,628,000 seconds), at the smallest size that is comfortable here (0.25 vCPU and 1 GB):

- CPU: 0.25 × 0.000011244 × 2,628,000 = **USD 7.39**
- Memory: 1 × 0.000001235 × 2,628,000 = **USD 3.25**
- Fargate subtotal: **about USD 10.64/month** in `us-east-1`

The Application Load Balancer is a separate hourly charge plus Load Balancer Capacity Units. At this traffic the LCU charge is small. The hourly rate is on the ELB pricing page and is not printed in the static page text; budget on the order of **USD 16/month** in US East and confirm it in the calculator, then add the RDS instance. Public IPv4 addresses are billed on top (see the VPC pricing page). A NAT gateway, if the task sits in a private subnet, is another always-on charge and is easy to exceed the app itself. For this API, avoid a NAT gateway.

São Paulo Fargate and ALB rates are higher than N. Virginia. Express Mode is available in São Paulo; Lightsail is the cheaper São Paulo path.

Sources:

- https://aws.amazon.com/fargate/pricing/
- https://aws.amazon.com/elasticloadbalancing/pricing/
- https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-overview.html

### Can AWS stay free for this demo?

For a few months, possibly. Forever, no.

- Lightsail’s old short trials are gone. New accounts use the general AWS free-tier credits (up to USD 200) plus one free month of the USD 15 database plan. A USD 25/month Lightsail pair spends a USD 200 credit in about eight months, then bills normally.
- RDS on the free plan is limited to 6 months and to `db.t3.micro` / `db.t4g.micro`. The API process in front of it is not free once credits run out.
- This demo does not change that. The meter is “one server running all month,” and 200 tutors are a few hundred kilobytes.

## Azure

### App plus managed PostgreSQL: yes

This is the closest match to the question, and it does not need a Dockerfile.

- **API:** Azure App Service, Linux, Node. Set `PORT` (App Service injects it), `DATABASE_URL`, `FIREBASE_PROJECT_ID`, and `FIREBASE_SERVICE_ACCOUNT`. Build with `npm run build`, start with `npm run start:prod`. Run `npx prisma migrate deploy` as a release step.
- **Database:** Azure Database for PostgreSQL, Flexible Server, Burstable **B1ms** (1 vCore, 2 GiB). Put it in the same region as the app. Require SSL on the connection string.

Both exist in **Brazil South**.

Retail prices from the Azure Retail Prices API on 11 October 2026 (`https://prices.azure.com/api/retail/prices`). Monthly figures use 730 hours.

| Piece | Region | Meter | Hourly or unit | Per month |
| --- | --- | --- | --- | --- |
| App Service Linux B1 (1 vCPU, 1.75 GB) | Brazil South | `Azure App Service Basic Plan - Linux` / `B1` | USD 0.020 / hour | **USD 14.60** |
| App Service Linux B1 | East US | same meter | USD 0.017 / hour | **USD 12.41** |
| App Service Linux F1 | Brazil South | `Azure App Service Free Plan - Linux` | USD 0 | **USD 0** |
| PostgreSQL Flexible Server, Burstable B1MS | Brazil South | `Burstable BS Series Compute` / meter `B1MS` | USD 0.035 / hour | **USD 25.55** |
| Same B1MS | East US | same | USD 0.017 / hour | **USD 12.41** |
| Database storage | Brazil South | `Azure Database for PostgreSQL Flex Server Storage` / `Storage Data Stored` | USD 0.2185 / GB-month | **USD 6.99** at the 32 GB minimum |
| Database storage | East US | same meter | USD 0.115 / GB-month | **USD 3.68** at 32 GB |
| Backup storage beyond the included amount | both regions sampled | `Backup Storage LRS Data Stored` | USD 0.095 / GB-month | about USD 0 while backups fit inside the free backup allowance |

Brazil South total for B1 + B1ms + 32 GB, single zone, no high availability: **about USD 47/month** before tax and egress.

East US total for the same shape: **about USD 29/month**.

F1 is always USD 0 and is the wrong plan for a clinic app. Microsoft’s pricing page says the free plan is for trials and learning, has no SLA, is metered at 60 CPU minutes per day and 1 GB RAM, and is not supported for production workloads. Basic B1 is the first plan with a custom domain, TLS, and Always On.

Sources:

- https://azure.microsoft.com/en-us/pricing/details/app-service/linux/
- https://azure.microsoft.com/en-us/pricing/details/postgresql/flexible-server/
- https://prices.azure.com/api/retail/prices (queried 11 October 2026; filters in the appendix)
- https://azure.microsoft.com/en-us/pricing/free-services (12-month PostgreSQL allowance)

### Can Azure stay free for this demo?

For the first year, the database can. The production app tier cannot.

New Azure customers get, for 12 months:

- 750 hours/month of PostgreSQL Flexible Server Burstable B1ms
- 32 GB storage and 32 GB backup storage

That is exactly one small database running all month. You have to move the subscription to pay-as-you-go within 30 days, or when the signup credit is used, or the account stops. After 12 months the same server bills at the rates above.

App Service F1 is always free and has enough CPU for this demo day (about 2 minutes of the 60 allowed). Microsoft still says not to use it for production: shared CPU, 60 minutes/day, no SLA, and the app can be unloaded when idle. Pairing F1 with the 12-month database matches a one-month demo. It is a weak choice if the same server is meant to stay up for a real clinic afterward.

After month 12 in Brazil South, budget **about USD 47/month**.

The “free 20 MB SQL database for 12 months” mentioned on the App Service page is Azure SQL, not PostgreSQL, and 20 MB is too small for this schema anyway.

## Locaweb

### App plus managed PostgreSQL: no

Locaweb’s database-as-a-service product is **SQL Server Standard 2017**, one database per plan, shared hardware, aimed at Windows apps. The public page does not offer PostgreSQL. Switching this API to SQL Server would be its own migration (Prisma provider, enums, `String[]`, JSON) and still would not be PostgreSQL.

Source: https://www.locaweb.com.br/database-as-a-service/

What Locaweb does offer for this stack is **Locaweb Cloud virtual machines** (infrastructure you administer). Their own tutorials for a Node or FastAPI API plus PostgreSQL install PostgreSQL on a VM, put it on a private network, and tell you never to publish port 5432.

Published VM prices (https://www.locaweb.com.br/locaweb-cloud/precos/), hourly with a monthly cap:

| Plan | Size | Monthly cap |
| --- | --- | --- |
| Micro | 1 vCPU, 1 GB, 40 GB SSD | R$ 20 |
| Small | 1 vCPU, 2 GB, 60 GB SSD | R$ 40 |
| Medium | 2 vCPU, 4 GB, 80 GB SSD | R$ 80 |
| Public IPv4 | | R$ 5 |
| NAT gateway | only if you use a private subnet that needs outbound internet | R$ 30 |
| Extra SSD | | R$ 0.30 / GB-month |

Egress is advertised as included.

For this demo the simplest Locaweb layout is **one Small VM (R$ 40) plus one public IP (R$ 5) = R$ 45/month**, with Node and PostgreSQL on the same machine and Postgres bound to localhost. That is one server, not an app platform plus a database platform. A Micro VM (1 GB) is tight once both processes are running. The 200 tutors do not need a bigger machine.

The layout in Locaweb’s own guides (a public app VM and a private database VM, each around 2 vCPU and 4 GB) is two Medium machines, **R$ 160/month**, plus a public IP and possibly a NAT gateway. That is safer and more than this workload needs.

No Locaweb Cloud free tier showed up on the price page. Older “Cloud Hosting” proposals in a Locaweb PDF describe PHP or ASP.NET with MySQL or PostgreSQL, not a current Node.js app platform. Do not plan on that PDF.

Sources:

- https://www.locaweb.com.br/locaweb-cloud/precos/
- https://www.locaweb.com.br/locaweb-cloud/
- https://www.locaweb.com.br/database-as-a-service/
- https://www.locaweb.com.br/ajuda/wiki/deploy-de-api-fastapi-com-postgresql-no-locaweb-cloud/
- https://www.locaweb.com.br/ajuda/wiki/hospedagem-do-hermes-via-containers-no-locaweb-cloud/

## Side-by-side after free periods

Prices are list prices on 11 October 2026. Tax treatment differs: AWS and Azure list prices are before tax; Locaweb’s DBaaS page says taxes are included, and the Cloud VM prices are the BRL amounts on the price table. Do not convert with a guessed exchange rate; use the rate on the day you compare.

| | Simplest shape | App platform | Managed PostgreSQL | Monthly floor for this demo | Stays free? |
| --- | --- | --- | --- | --- | --- |
| Azure, Brazil South | App Service Linux B1 + Flexible Server B1ms, 32 GB | Yes, Node, no Dockerfile | Yes | about USD 47 | Database for 12 months on a new account. App Service F1 is always free and is not a production plan. |
| Azure, East US | same | Yes | Yes | about USD 29 | same introductory rules |
| AWS Lightsail, São Paulo | Micro container + USD 15 PostgreSQL | Yes, needs a Dockerfile | Yes | USD 25 | Credits and one free database month, then no |
| AWS ECS Express Mode + RDS, US East | 0.25 vCPU / 1 GB Fargate + ALB + `db.t4g.micro` | Yes, needs a Dockerfile | Yes | about USD 10.64 Fargate + ALB (budget ~USD 16) + RDS (ballpark ~USD 12) + storage | RDS micro for up to 6 months on the free plan, plus up to USD 200 credits |
| Locaweb Cloud | One Small VM, Node and PostgreSQL together | No. You patch the OS. | No | about R$ 45 | No |

One clinic and 200 tutors stay on the smallest size. The next size up is a performance choice, not a capacity requirement, until exam payloads or background jobs show up.

## Firestore instead of PostgreSQL

### What “entirely” can mean

Two different refactors get called “use Firestore.”

**A. Swap Prisma for Firestore inside this NestJS API.** `firebase-admin` is already a dependency, but only for Auth. Prisma has no Firestore provider, so every service in `src/owner`, `src/dashboard`, `src/consulta`, `src/notifications`, and `src/products` would be rewritten, and `prisma/schema.prisma` plus migrations would go away. The API process still has to be hosted. This saves the database bill and keeps the AWS, Azure, or Locaweb app bill.

**B. Delete the API.** The mobile client uses the Firestore SDK and Firebase Auth, and security rules enforce that a vet can only read and write their own clinic. Schedule generation (`src/common/schedule.ts`), product price lookup, and the SaaS fee live in the client or in Cloud Functions. This is the only variant that can drop the app host.

Auth for 200 monthly active users fits the free authentication allowance. Email, social, and anonymous sign-in are free up to 50,000 monthly active users. Phone SMS is a separate, paid meter and needs the Blaze plan.

Sources:

- https://firebase.google.com/pricing/
- https://cloud.google.com/identity-platform/pricing
- https://firebase.google.com/docs/auth/limits

### Free quotas (Spark, and the same daily amounts on Blaze before overage)

From the Firestore pricing docs, last updated 8 October 2026 on the Firebase copy:

| Meter | Free amount |
| --- | --- |
| Stored data | 1 GiB |
| Document reads | 50,000 per day |
| Document writes | 20,000 per day |
| Document deletes | 20,000 per day |
| Egress | 10 GiB per month |

Quotas reset around midnight Pacific time. Only one database per project gets the free quota. On the Spark plan, crossing a quota turns that product off until the quota resets. On Blaze, the overage is billed and the app keeps running.

Paid Standard edition rates depend on region. A static fetch of https://cloud.google.com/firestore/pricing on 11 October 2026 rendered the Iowa (`us-central1`) column:

- reads USD 0.03 per 100,000
- writes USD 0.09 per 100,000
- deletes USD 0.01 per 100,000

São Paulo (`southamerica-east1`) is on that page’s region list. Select it in the browser before using a São Paulo number; the fetched HTML did not include a separate São Paulo Standard-edition table. Do not reuse Enterprise edition unit prices for this estimate.

Sources:

- https://firebase.google.com/docs/firestore/pricing
- https://firebase.google.com/docs/firestore/quotas
- https://cloud.google.com/firestore/pricing
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans

### Will this demo fit the free quota?

Yes. One clinic, 200 tutors, one pet each, and no care plans is a few hundred writes and, if the tutor list is opened ten times, about 4,000 reads. Both are inside the daily free caps (20,000 writes, 50,000 reads), and the other 29 days add none. Storage is a few hundred KB of the free 1 GiB.

The case that does not fit is a different product: 200 clinics each opening a year of appointments every day. That was about 124,000 reads on one day, and Spark would turn Firestore off until the quota resets. It is not this demo.

One demo-day spike still to avoid on Spark: generating a year of appointments for all 200 pets on that same day. `createPlan` writes on the order of 150 rows per pet, and 200 pets would pass 20,000 writes. Creating the tutors does not.

### What the rewrite has to re-implement

These are enforced by PostgreSQL today and are application code in Firestore:

- **Transactions.** `createPlan` and `updatePlan` use `prisma.$transaction`. Firestore transactions exist, and a transaction is limited. If `planDurationInMonths` stays an unbounded integer (`src/owner/owner.schemas.ts`), a long plan can exceed the number of writes one transaction will accept. Cap the duration or split the batch and accept a window where the old plan is already deleted.
- **Uniqueness.** `@@unique([userId, document])` on `Owner` becomes a query inside a transaction. Two simultaneous creates can race if that transaction is skipped.
- **Cascades.** Deleting a tutor deletes pets, plans, consultas, and appointments in Postgres. Firestore does not cascade. A delete has to walk the tree, and a client disconnect in the middle leaves orphans.
- **Joins.** The dashboard and the plan screen join appointments to products. The API already copies `appointmentPrice` onto the notification at write time, which is the right Firestore shape. Anything that still joins at read time has to be denormalized or read as a second query (and that second query counts as more reads).
- **Tenant isolation.** Today every query filters `userId` in the server. If the client talks to Firestore, security rules have to repeat that filter. A missing rule is a cross-clinic data leak. Rules that call `get()` add extra billed reads.
- **Types.** `PetSex`, `PlanRecurrency`, `SaaSPlan`, `prescription String[]`, and `exams Json` become conventions. Nothing stops a client from writing a bad enum unless rules or Cloud Functions check it.

Cloud Functions, if you keep schedule generation on the server, **require the Blaze plan** (a billing account). The no-cost invocation tier is 2,000,000 invocations, 400,000 GB-seconds, 200,000 CPU-seconds, and 5 GB of egress per month, which 200 clinics would not exhaust. Firebase’s own pricing-plan page says Cloud Functions are the exception that can still produce a small charge inside that tier, because deploys store the function container. Budget a few cents and a billing account, not a free Spark project, if functions stay in the design.

Sources:

- https://firebase.google.com/docs/functions/quotas
- https://firebase.google.com/docs/functions/faq-and-troubleshooting
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans

### Recommendation on Firestore

Keep PostgreSQL. The hosting floor for this API is about USD 25–47 or R$ 45, and a Firestore rewrite does not remove that floor unless the API is deleted. Deleting the API moves tenant checks, plan generation, and deletes into rules and the client, which is a larger change than the hosting bill.

Use Firestore only if the product goal is to drop the backend and accept a new data model. If you do that, stay on Blaze with a budget alert so a busy dashboard cannot turn the database off, put the database in `southamerica-east1` if the clinics are in Brazil, and denormalize the dashboard so one clinic open is a handful of reads.

## What to change in this repo when you pick a host

None of this is implemented yet. It is the checklist for the chosen host.

1. Set `NODE_ENV=production` so `AUTH_DEV_BYPASS` is ignored (see the README).
2. Set `DATABASE_URL` with SSL required. Managed PostgreSQL rejects the local `postgresql://veti:veti@localhost` URL.
3. Run `npx prisma migrate deploy --config prisma7.config.ts` on each release, not `migrate dev`.
4. Put the Firebase service account in the host’s secret store as `FIREBASE_SERVICE_ACCOUNT`, and set `FIREBASE_PROJECT_ID` to the same project.
5. For Lightsail containers or ECS Express Mode, add a Dockerfile that runs `node dist/main` and listens on `PORT`. Nest’s `app.listen(port)` already binds all interfaces.
6. On Locaweb, do not publish port 5432. Install PostgreSQL on the VM or on a second VM on a private network, and keep backups yourself. There is no managed backup product for PostgreSQL there.

## Appendix: Azure price query

Queried 11 October 2026 against `https://prices.azure.com/api/retail/prices`.

- App Service Linux B1, Brazil South: `serviceName eq 'Azure App Service' and armRegionName eq 'brazilsouth' and skuName eq 'B1'` → `Azure App Service Basic Plan - Linux`, meter `B1`, USD 0.020 per hour.
- App Service Linux B1, East US: same filter with `eastus` → USD 0.017 per hour.
- App Service Linux F1, Brazil South: `contains(skuName, 'F1')` → USD 0 per hour.
- PostgreSQL B1MS: `productName eq 'Azure Database for PostgreSQL Flexible Server Burstable BS Series Compute'` in `brazilsouth` → meter `B1MS`, USD 0.035 per hour. Same product in `eastus` → USD 0.017 per hour.
- Data storage: product `Azure Database for PostgreSQL Flex Server Storage`, meter `Storage Data Stored` → USD 0.2185 per GB-month in `brazilsouth`, USD 0.115 per GB-month in `eastus`.
- Backup: product `Azure Database for PostgreSQL Flexible Server Backup Storage`, meter `Backup Storage LRS Data Stored` → USD 0.095 per GB-month in both regions.

Flexible Server still bills backup only beyond the included backup storage. Confirm the included amount on the PostgreSQL pricing page when you provision, because a long retention window can exceed it.
