
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
const ASAAS_URL = 'https://www.asaas.com/api/v3' // Use 'https://sandbox.asaas.com/api/v3' for testing if needed

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { userId, email, name } = await req.json()

    if (!userId || !email) {
      throw new Error('Dados do usuário incompletos')
    }

    // 1. Verificar se o aluno já tem ID Asaas
    const { data: studentData } = await supabase
      .from('students')
      .select('asaas_customer_id')
      .eq('user_id', userId)
      .single()

    let asaasCustomerId = studentData?.asaas_customer_id

    // 2. Se não tiver, cria cliente no Asaas
    if (!asaasCustomerId) {
      // Verifica se já existe no Asaas por email (evita duplicação)
      const searchResponse = await fetch(`${ASAAS_URL}/customers?email=${email}`, {
        headers: { 'access_token': ASAAS_API_KEY! }
      })
      const searchData = await searchResponse.json()

      if (searchData.data && searchData.data.length > 0) {
        asaasCustomerId = searchData.data[0].id
      } else {
        // Cria novo
        const createResponse = await fetch(`${ASAAS_URL}/customers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY!
          },
          body: JSON.stringify({
            name: name,
            email: email,
            notificationDisabled: false
          })
        })
        const newCustomer = await createResponse.json()
        if (newCustomer.errors) throw new Error(`Erro Asaas: ${newCustomer.errors[0].description}`)
        asaasCustomerId = newCustomer.id
      }

      // Salva o ID no Supabase
      await supabase
        .from('students')
        .update({ asaas_customer_id: asaasCustomerId })
        .eq('user_id', userId)
    }

    // 3. Criar Assinatura
    const subscriptionResponse = await fetch(`${ASAAS_URL}/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY!
        },
        body: JSON.stringify({
          customer: asaasCustomerId,
          billingType: 'UNDEFINED', // Permite ao usuário escolher PIX ou Cartão na tela de pagamento
          value: 29.90,
          nextDueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Amanhã
          cycle: 'MONTHLY',
          description: 'Assinatura AprovaMed IA - Plano Mensal'
        })
    })

    const subscriptionData = await subscriptionResponse.json()
    
    // Se der erro de assinatura duplicada ou outro, tentamos pegar o link de pagamento direto ou tratamos
    if (subscriptionData.errors) {
       // Se já existe, poderíamos tentar recuperar a existente, mas por simplicidade vamos retornar erro para o usuário tentar gerenciar.
       // Em produção robusta, listaríamos assinaturas ativas.
       throw new Error(`Erro ao criar assinatura: ${subscriptionData.errors[0].description}`)
    }

    // 4. Retornar URL de pagamento
    // As assinaturas do Asaas não retornam um "invoiceUrl" imediato na criação da assinatura em si, 
    // mas geram uma cobrança. Precisamos pegar a URL da cobrança gerada ou usar a URL da assinatura se disponível.
    // Geralmente a resposta da subscription tem "id".
    
    // Para simplificar o fluxo e garantir que o aluno pague agora, vamos pegar a cobrança gerada por essa assinatura.
    const chargesResponse = await fetch(`${ASAAS_URL}/payments?subscription=${subscriptionData.id}`, {
        headers: { 'access_token': ASAAS_API_KEY! }
    })
    const chargesData = await chargesResponse.json()
    
    if (chargesData.data && chargesData.data.length > 0) {
        return new Response(
            JSON.stringify({ paymentUrl: chargesData.data[0].invoiceUrl }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } else {
        // Fallback: URL genérica ou aguardar webhook (menos ideal para UX)
        throw new Error("Cobrança ainda não gerada. Tente novamente em instantes.")
    }

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
