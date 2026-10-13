/* Explicit read-only adapter: two fixed GraphQL queries, no arbitrary query input.
 * Docs checked 2026-09-21. API version pinned; actual shop scopes still need a live probe. */
const QUERIES={
  products:`query PodProducts($after: String) { products(first: 50, after: $after) { nodes { id title status updatedAt } pageInfo { hasNextPage endCursor } } }`,
  orders:`query PodOrders($after: String) { orders(first: 50, after: $after, sortKey: UPDATED_AT, reverse: true) { nodes { id createdAt updatedAt displayFinancialStatus displayFulfillmentStatus currentTotalPriceSet { shopMoney { amount currencyCode } } } pageInfo { hasNextPage endCursor } } }`
};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function readShopify({shop,token,resource,maxPages=2,fetchImpl=fetch,sleep=wait}){
  if(typeof shop!=='string'||!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop))throw new Error('Use a bare myshopify.com domain; custom URLs are rejected');
  if(typeof token!=='string'||!token.trim()||/[\r\n]/.test(token))throw new Error('SHOPIFY_ADMIN_ACCESS_TOKEN must be supplied through the environment');
  if(!Object.prototype.hasOwnProperty.call(QUERIES,resource))throw new Error('Only products and orders can be read');
  if(!Number.isInteger(maxPages)||maxPages<1||maxPages>100)throw new Error('maxPages must be 1..100');
  let after=null,pages=0,complete=false;const rows=new Map(),seenCursors=new Set();
  for(;pages<maxPages;){
    let data,ok=false;
    for(let attempt=0;attempt<3;attempt++){
      let res;
      try{res=await fetchImpl('https://'+shop+'/admin/api/2026-07/graphql.json',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json','X-Shopify-Access-Token':token},body:JSON.stringify({query:QUERIES[resource],variables:{after}})});}
      catch{throw new Error('Shopify read network/timeout failure; credentials were not logged');}
      if(res.status===429){
        if(attempt===2)throw new Error('Shopify read rate limit; retry later');
        const seconds=Number(res.headers.get('retry-after'));await sleep(Number.isFinite(seconds)&&seconds>0?Math.min(seconds*1000,60000):1000*(attempt+1));continue;
      }
      if(res.status===401||res.status===403)throw new Error('Shopify read access denied; check the app and its read scopes');
      if(!res.ok)throw new Error('Shopify read HTTP '+res.status);
      let body;try{body=await res.json();}catch{throw new Error('Invalid Shopify JSON response');}
      if(body.errors?.length){
        if(body.errors.every(e=>e.extensions?.code==='THROTTLED')&&attempt<2){await sleep(1000*(attempt+1));continue;}
        throw new Error('Shopify GraphQL read failed; no partial errors were converted into zero values');
      }
      data=body.data?.[resource];
      if(!data||!Array.isArray(data.nodes)||typeof data.pageInfo?.hasNextPage!=='boolean')throw new Error('Incomplete Shopify response');
      ok=true;break;
    }
    if(!ok)throw new Error('Shopify retry limit reached');
    for(const node of data.nodes){if(!node||typeof node.id!=='string'||!node.id)throw new Error('Source row lacks a stable id');rows.set(node.id,node);}
    pages++;
    if(!data.pageInfo.hasNextPage){complete=true;break;}
    const cursor=data.pageInfo.endCursor;
    if(typeof cursor!=='string'||!cursor||seenCursors.has(cursor))throw new Error('Invalid/repeated pagination cursor');
    seenCursors.add(cursor);after=cursor;
  }
  return{schema:'pod-observation/1',resource,observed_at:new Date().toISOString(),api_version:'2026-07',pages,complete,rows:[...rows.values()],
    limitations:resource==='orders'?'Only orders visible to this app. Historical access, supplier production and carrier events are NOT verified. Not a full profit ledger.':'Product summary only. Variant/print-provider mapping must be verified separately.'};
}
