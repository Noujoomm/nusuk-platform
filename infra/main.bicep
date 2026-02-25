// ─── NUSUK Platform — Azure Infrastructure ───
// Deploy: az deployment group create -g <rg> -f infra/main.bicep -p pgPassword='<pw>' jwtSecret='<s>' jwtRefreshSecret='<s>'

@description('Azure region')
param location string = resourceGroup().location

@description('Unique prefix for all resources')
param prefix string = 'nusuk'

@description('PostgreSQL admin password')
@secure()
param pgPassword string

@description('JWT signing secret')
@secure()
param jwtSecret string

@description('JWT refresh signing secret')
@secure()
param jwtRefreshSecret string

@description('App Service Plan SKU')
param appServiceSku string = 'B1'

// ─── Variables ───
var acrName = '${prefix}acr${uniqueString(resourceGroup().id)}'
var pgServerName = '${prefix}-pg-${uniqueString(resourceGroup().id)}'
var planName = '${prefix}-plan'
var apiAppName = '${prefix}-api'
var webAppName = '${prefix}-web'
var pgDbName = 'nusuk_db'
var pgAdmin = 'nusukadmin'

// ─── Azure Container Registry ───
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// ─── PostgreSQL Flexible Server ───
resource pgServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: pgServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: pgAdmin
    administratorLoginPassword: pgPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

// Allow Azure services
resource pgFirewall 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: pgServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Database
resource pgDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: pgServer
  name: pgDbName
}

// ─── App Service Plan (Linux) ───
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  kind: 'linux'
  sku: {
    name: appServiceSku
  }
  properties: {
    reserved: true
  }
}

// ─── API App Service ───
resource apiApp 'Microsoft.Web/sites@2023-12-01' = {
  name: apiAppName
  location: location
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/${prefix}-api:latest'
      webSocketsEnabled: true
      alwaysOn: true
      appSettings: [
        { name: 'DOCKER_REGISTRY_SERVER_URL', value: 'https://${acr.properties.loginServer}' }
        { name: 'DOCKER_REGISTRY_SERVER_USERNAME', value: acr.listCredentials().username }
        { name: 'DOCKER_REGISTRY_SERVER_PASSWORD', value: acr.listCredentials().passwords[0].value }
        { name: 'WEBSITES_PORT', value: '8080' }
        { name: 'NODE_ENV', value: 'production' }
        { name: 'PORT', value: '8080' }
        { name: 'DATABASE_URL', value: 'postgresql://${pgAdmin}:${pgPassword}@${pgServer.properties.fullyQualifiedDomainName}:5432/${pgDbName}?sslmode=require' }
        { name: 'JWT_SECRET', value: jwtSecret }
        { name: 'JWT_REFRESH_SECRET', value: jwtRefreshSecret }
        { name: 'JWT_ACCESS_EXPIRES', value: '15m' }
        { name: 'JWT_REFRESH_EXPIRES', value: '7d' }
        { name: 'CORS_ORIGINS', value: 'https://${webAppName}.azurewebsites.net' }
      ]
    }
  }
}

// ─── Web App Service ───
resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/${prefix}-web:latest'
      webSocketsEnabled: true
      alwaysOn: true
      appSettings: [
        { name: 'DOCKER_REGISTRY_SERVER_URL', value: 'https://${acr.properties.loginServer}' }
        { name: 'DOCKER_REGISTRY_SERVER_USERNAME', value: acr.listCredentials().username }
        { name: 'DOCKER_REGISTRY_SERVER_PASSWORD', value: acr.listCredentials().passwords[0].value }
        { name: 'WEBSITES_PORT', value: '8080' }
        { name: 'NODE_ENV', value: 'production' }
        { name: 'PORT', value: '8080' }
      ]
    }
  }
}

// ─── Outputs ───
output acrLoginServer string = acr.properties.loginServer
output acrName string = acr.name
output apiUrl string = 'https://${apiApp.properties.defaultHostName}'
output webUrl string = 'https://${webApp.properties.defaultHostName}'
output pgHost string = pgServer.properties.fullyQualifiedDomainName
output apiAppName string = apiApp.name
output webAppName string = webApp.name
