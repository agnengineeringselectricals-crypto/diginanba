import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const root=dirname(fileURLToPath(import.meta.url));
const connectionString=process.env.DATABASE_URL;
if(!connectionString){
  console.error('DATABASE_URL is required. No database migration was attempted.');
  process.exitCode=1;
}else{
  const pool=new Pool({connectionString,ssl:process.env.DATABASE_SSL==='false'?false:{rejectUnauthorized:false}});
  const client=await pool.connect();
  const lockKey=7269132026;
  try{
    await client.query(`CREATE TABLE IF NOT EXISTS diginanba_schema_migrations (
      name TEXT PRIMARY KEY,
      checksum_sha256 TEXT NOT NULL CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await client.query('SELECT pg_advisory_lock($1)',[lockKey]);
    const files=(await readdir(join(root,'migrations'))).filter((name)=>/^\d{3}_.+\.sql$/.test(name)).sort();
    for(const name of files){
      const sql=await readFile(join(root,'migrations',name),'utf8');
      const checksum=createHash('sha256').update(sql).digest('hex');
      const existing=await client.query('SELECT checksum_sha256 FROM diginanba_schema_migrations WHERE name=$1',[name]);
      if(existing.rowCount){
        if(existing.rows[0].checksum_sha256!==checksum) throw new Error(`Applied migration ${name} was modified. Create a new migration instead.`);
        console.log(`Already applied: ${name}`);
        continue;
      }
      await client.query('BEGIN');
      try{
        await client.query(sql);
        await client.query('INSERT INTO diginanba_schema_migrations(name,checksum_sha256) VALUES($1,$2)',[name,checksum]);
        await client.query('COMMIT');
        console.log(`Applied: ${name}`);
      }catch(error){
        await client.query('ROLLBACK');
        throw error;
      }
    }
  }catch(error){
    console.error(`Database migration stopped safely: ${error instanceof Error?error.message:'unknown error'}`);
    process.exitCode=1;
  }finally{
    try{await client.query('SELECT pg_advisory_unlock($1)',[lockKey]);}catch{}
    client.release();
    await pool.end();
  }
}
