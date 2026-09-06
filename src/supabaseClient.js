import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ptihfsudwycuerdkklgz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aWhmc3Vkd3ljdWVyZGtrbGd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NzUxNjcsImV4cCI6MjEwMjI1MTE2N30.YeSrlZEBTlQt-97X1RIsclzm33tSy9QeOCeABrcYd-s'

export const supabase = createClient(supabaseUrl, supabaseKey)