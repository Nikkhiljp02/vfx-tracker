# Switch to SQLite for local development
Write-Host "🔄 Switching to LOCAL development mode (SQLite)..." -ForegroundColor Cyan

# Ensure we're using the SQLite schema
$schemaPath = "prisma\schema.prisma"
$productionSchemaPath = "prisma\schema.production.prisma"

# Check if we need to switch
$currentSchema = Get-Content $schemaPath -Raw
if ($currentSchema -match 'provider = "postgresql"') {
    Write-Host "📄 Switching schema file to SQLite..." -ForegroundColor Yellow
    
    # The schema.prisma is already SQLite by default
    # Just make sure it has sqlite provider
    Write-Host "   Using: prisma/schema.prisma (SQLite)" -ForegroundColor White
} else {
    Write-Host "   Already using SQLite schema" -ForegroundColor Green
}

# Update .env file
$envPath = ".env"
$envContent = Get-Content $envPath -Raw

# Set DATABASE_URL to SQLite
$envContent = $envContent -replace 'DB_PROVIDER="postgresql"', 'DB_PROVIDER="sqlite"'
$envContent = $envContent -replace 'DB_PROVIDER=postgresql', 'DB_PROVIDER="sqlite"'

Set-Content $envPath $envContent

Write-Host "✅ Switched to SQLite!" -ForegroundColor Green
Write-Host "📝 .env updated:" -ForegroundColor Yellow
Write-Host "   DATABASE_URL=file:./dev.db" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Regenerating Prisma Client..." -ForegroundColor Cyan
npx prisma generate

Write-Host ""
Write-Host "✨ Ready for local development!" -ForegroundColor Green
Write-Host "💡 Run: npm run dev" -ForegroundColor Yellow
