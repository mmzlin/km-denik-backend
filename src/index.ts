import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const API_KEY = process.env.API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Chybí povinné env proměnné: SUPABASE_URL a/nebo SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const app = express()
app.use(cors())
app.use(express.json())

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Volitelná autentizace přes X-API-Key. Pokud env API_KEY není nastavený,
// endpoint zůstává otevřený (zpětná kompatibilita s aktuálním Make scénářem).
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  if (!API_KEY) return next()
  const provided = req.header('x-api-key')
  if (provided !== API_KEY) {
    return res.status(401).json({ error: 'Neplatný nebo chybějící X-API-Key' })
  }
  next()
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/rides/summary', requireApiKey, async (req, res) => {
  const { user_id, from, to } = req.query as Record<string, string>

  if (!user_id || !from || !to) {
    return res.status(400).json({ error: 'Chybí parametry: user_id, from, to' })
  }

  if (!UUID_V4.test(user_id)) {
    return res.status(400).json({ error: 'user_id musí být platné UUID' })
  }

  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return res.status(400).json({ error: 'from a to musí být ve formátu YYYY-MM-DD' })
  }

  if (from > to) {
    return res.status(400).json({ error: 'from nesmí být po to' })
  }

  const { data, error } = await supabase
    .from('rides')
    .select('date, km, notes')
    .eq('user_id', user_id)
    .gte('date', from)
    .lte('date', to)
    .order('date')

  if (error) return res.status(500).json({ error: error.message })

  const totalKm = data.reduce((sum, r) => sum + Number(r.km ?? 0), 0)

  res.json({
    rides: data,
    totalKm: Math.round(totalKm * 10) / 10,
    totalRides: data.length,
    from,
    to,
  })
})

const PORT = Number(process.env.PORT) || 3001
app.listen(PORT, () => {
  console.log(`KM Deník API běží na portu ${PORT}`)
})
