type D1QueryResult<T>={results?:T[];success?:boolean};
type D1Response<T>={success:boolean;errors?:{message:string}[];result?:D1QueryResult<T>[]};

function config(){
 const accountId=process.env.CLOUDFLARE_ACCOUNT_ID;
 const databaseId=process.env.CLOUDFLARE_D1_DATABASE_ID;
 const token=process.env.CLOUDFLARE_D1_API_TOKEN;
 if(!accountId||!databaseId||!token)throw new Error('D1 is not configured');
 return{accountId,databaseId,token};
}

export async function d1Query<T=Record<string,unknown>>(sql:string,params:(string|number|null)[]=[]):Promise<T[]>{
 const{accountId,databaseId,token}=config();
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql,params}),cache:'no-store'});
 const data=await response.json() as D1Response<T>;
 if(!response.ok||!data.success)throw new Error(data.errors?.map(error=>error.message).join(', ')||`D1 query failed: ${response.status}`);
 return data.result?.flatMap(result=>result.results??[])??[];
}

export async function d1Execute(sql:string,params:(string|number|null)[]=[]){await d1Query(sql,params)}
