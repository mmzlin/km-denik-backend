import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const app = express()
app.use(cors())
app.use(express.json())

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/rides/summary', async (req, res) => {
  const { user_id, from, to } = req.query as Record<string, string>

  if (!user_id || !from || !to) {
    return res.status(400).json({ error: 'Chybí parametry: user_id, from, to' })
  }

  const { data, error } = await supabase
    .from('rides')
    .select('date, km, notes')
    .eq('user_id', user_id)
    .gte('date', from)
    .lte('date', to)
    .order('date')

  if (error) return res.status(500).json({ error: error.message })

  const totalKm = data.reduce((sum, r) => sum + Number(r.km), 0)

  res.json({
    rides: data,
    totalKm: Math.round(totalKm * 10) / 10,
    totalRides: data.length,
    from,
    to,
  })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`KM Deník API běží na portu ${PORT}`)
})
