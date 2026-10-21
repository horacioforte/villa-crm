const fs=require('fs');
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z_]+)=(.*)$/); if(m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^"|"$/g,''); }
const {Client}=require('pg');
(async()=>{
 const c=new Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
 await c.connect();
 const r=await c.query(`select tipo,status,count(*)::int n from "DossieComercial" group by 1,2 order by 1,2`);
 console.log(JSON.stringify(r.rows));
 const q=await c.query(`select titulo,tipo,status,completude,"ultimaAtividade",left(coalesce("missaoAtual",''),70) m from "DossieComercial" where status in ('INVESTIGANDO','PEDIR_MAIS_PESQUISA') order by "ultimaAtividade" asc nulls first limit 25`);
 console.log(JSON.stringify(q.rows));
 await c.end();
})().catch(e=>console.log('ERR',e.message));
