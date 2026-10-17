import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
// Set UAZAPI_SEND_URL to the documented send endpoint for YOUR UAZAPI version.
// Set UAZAPI_TOKEN and SUPABASE_SERVICE_ROLE_KEY as Edge Function secrets.
Deno.serve(async(request)=>{
 const origin=request.headers.get('origin')||'';
 const allowed=(Deno.env.get('CRM_ALLOWED_ORIGIN')||'').split(',').map(x=>x.trim());
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':allowed.includes(origin)?origin:'','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
 if(request.method==='OPTIONS')return new Response('',{status:204,headers});
 if(request.method!=='POST')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers});
 if(!allowed.includes(origin))return new Response(JSON.stringify({error:'Origin not allowed'}),{status:403,headers});
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const token=request.headers.get('Authorization')?.replace(/^Bearer /i,'')||'';
 const authClient=createClient(url,anon);const{data:{user},error}=await authClient.auth.getUser(token);
 if(error||!user)return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers});
 const admin=createClient(url,service);const{data:member}=await admin.from('crm_members').select('user_id').eq('user_id',user.id).maybeSingle();
 if(!member)return new Response(JSON.stringify({error:'Forbidden'}),{status:403,headers});
 let input;try{input=await request.json()}catch{return new Response(JSON.stringify({error:'Invalid JSON'}),{status:400,headers})}
 const leadId=String(input.lead_id||''),body=String(input.text||'').trim();
 if(!/^[0-9a-f-]{36}$/i.test(leadId)||!body||body.length>4000)return new Response(JSON.stringify({error:'Invalid lead/message'}),{status:400,headers});
 const{data:lead}=await admin.from('crm_leads').select('phone').eq('id',leadId).maybeSingle();
 if(!lead)return new Response(JSON.stringify({error:'Lead missing'}),{status:404,headers});
 const endpoint=Deno.env.get('UAZAPI_SEND_URL'),apiToken=Deno.env.get('UAZAPI_TOKEN');
 if(!endpoint||!apiToken)return new Response(JSON.stringify({error:'UAZAPI not configured'}),{status:503,headers});
 // Verify outbound JSON property names with your deployed UAZAPI version before enabling.
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','token':apiToken},body:JSON.stringify({number:lead.phone,text:body})});
 if(!response.ok)return new Response(JSON.stringify({error:'WhatsApp send failed',status:response.status}),{status:502,headers});
 const result=await response.json().catch(()=>({}));
 await admin.from('crm_messages').insert({lead_id:leadId,direction:'out',body,status:'sent',external_id:result?.messageid||result?.id||null});
 return new Response(JSON.stringify({ok:true}),{headers});
});
