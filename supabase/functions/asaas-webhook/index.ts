
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { event, payment } = await req.json()

  if (!payment || !payment.customer) {
      return new Response('Ignored', { status: 200 })
  }

  const customerId = payment.customer

  if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      // Liberar acesso
      await supabase
          .from('students')
          .update({ subscription_status: 'active' })
          .eq('asaas_customer_id', customerId)
      
      console.log(`Acesso liberado para cliente ${customerId}`)
  } 
  else if (event === 'PAYMENT_OVERDUE' || event === 'SUBSCRIPTION_DELETED') {
      // Bloquear acesso
      await supabase
          .from('students')
          .update({ subscription_status: 'inactive' })
          .eq('asaas_customer_id', customerId)
      
      console.log(`Acesso revogado para cliente ${customerId}`)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
