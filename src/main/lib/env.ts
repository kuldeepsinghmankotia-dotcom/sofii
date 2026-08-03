import dotenv from 'dotenv'

export function loadEnv(): void {
  dotenv.config({ override: true })
}
