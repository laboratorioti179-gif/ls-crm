# LS CRM — MVP Web

Primeira versão utilizável com dashboard, conversas armazenadas, funil, follow-ups, clientes, autenticação e atualizações em tempo real. **Nenhuma integração externa vem conectada de fábrica.** Números são reais somente após ingestão validada de eventos.

## Implantação
1. Crie um projeto Supabase separado do AutoPrime para testar sem afetar o sistema existente. Execute `supabase/schema.sql` no SQL Editor após revisar permissões e políticas.
2. Em Supabase > Authentication, crie/invite um usuário. No SQL Editor, vincule-o manualmente: `insert into public.crm_members(user_id,role) values ('UUID_DO_AUTH_USER','admin');` (não use e-mails nem exponha service role no navegador).
3. `npm install`; copie `.env.example` para `.env` e informe URL e chave **publicável/anon** do Supabase. `npm run dev` e entre com o usuário autorizado. `npm run build` para Vercel.
4. Para envio pelo WhatsApp: implemente/revise o endpoint UAZAPI da SUA versão, configure os segredos `UAZAPI_SEND_URL`, `UAZAPI_TOKEN`, `CRM_ALLOWED_ORIGIN`, `SUPABASE_SERVICE_ROLE_KEY`, e implante Edge Function `crm-send-message`. Ajuste formato de retorno conforme instância. Não marque envios como sucesso antes da confirmação.
5. Configure n8n (ou receptor backend dedicado) para receber webhooks da UAZAPI, validar proveniência e gravar `crm_leads` e `crm_messages` com service role; inclua tanto mensagens recebidas quanto enviadas. Use external_id único para deduplicação e não crie outra conversa para cada evento. Backfill histórico exige API compatível.
6. No evento real e confirmado de criação de conta no AutoPrime, associe usuário e telefone e preencha `crm_leads.registered_at` e `autoprime_user_id`. Nunca considere simples clique no link como cadastro.
7. Receba webhooks do Asaas em backend verificado por token; guarde id único em `crm_payment_events` antes de processar para idempotência; vincule cliente pelo ID Asaas e assinatura pelo ID da assinatura. Atualize `crm_subscriptions` e `first_paid_at` **somente após pagamento confirmado**. Assinatura criada não significa pagamento. Reconciliar periodicamente via API.
8. Para automação de follow-ups crie fluxo agendado no n8n: busque `crm_followups` pendentes com `due_at <= now()`, respeite opt-out, janela e regras de envio WhatsApp, e grave tentativas/status; desative automação quando `human_takeover=true`. O MVP cria e conclui follow-ups manualmente, não dispara mensagens sozinho.

## Contagem e métricas
- **Conversas iniciadas:** leads com `first_contact_at` preenchido, apenas contatos únicos.
- **Cadastros confirmados:** leads com `registered_at` preenchido, evento vindo do AutoPrime.
- **Pagantes:** leads com assinatura `active` E `first_paid_at` preenchido, conforme evento confirmado do Asaas.
- **Taxa conversa → cadastro:** cadastros/conversas iniciadas; **conversa → pagante:** pagantes/conversas iniciadas. Para análises por período/coorte, implemente filtros e snapshots posteriormente.

## Atenções
- MVP não contém um webhook público pronto para UAZAPI/Asaas: **eles exigem integração e validação de payload real**. Este projeto não pode ser descrito como integrado até testes ponta a ponta.
- O projeto não toca nas tabelas já existentes do AutoPrime nem substitui automações n8n.
- Revise LGPD, consentimento, segurança, backups, autenticação multiusuário e limites de envio antes de usar em produção.
- Use chave `service_role` somente em n8n/Edge Function/backend; nunca no frontend. O controle RLS inicial permite acesso dos membros autorizados a todos os leads (adequado à equipe inicial); restrinja por equipe quando multiempresa.
