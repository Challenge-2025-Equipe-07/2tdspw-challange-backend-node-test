using 'main.bicep'

param location = 'chilecentral'
param postgresAdminLogin = 'vetiadmin'

// Assigned here so the params file is complete. The values come from the
// environment at deploy time and are not written in this file.
param postgresAdminPassword = readEnvironmentVariable('POSTGRES_ADMIN_PASSWORD')
param clientIp = readEnvironmentVariable('CLIENT_IP')
