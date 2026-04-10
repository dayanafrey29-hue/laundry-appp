import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cpeqwyswrpaiilbbpbrm.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZXF3eXN3cnBhaWlsYmJwYnJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4Mjc0MTEsImV4cCI6MjA5MTQwMzQxMX0.dF4v7N5FnZWN4Qan8jigWorIVK9b7f3wKEQgeFaONLY'

export const supabase = createClient(supabaseUrl, supabaseKey)