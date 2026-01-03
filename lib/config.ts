/**
 * Application configuration
 * 
 * API URL should be set via NEXT_PUBLIC_API_URL environment variable.
 * For local development, create a .env.local file with:
 * NEXT_PUBLIC_API_URL=http://localhost:8000/api
 * 
 * In production, this should be set via deployment platform environment variables.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://dararabappbackendv01-production.up.railway.app/api"

