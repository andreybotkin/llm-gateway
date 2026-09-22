const crypto = require('crypto');
const datasourceModule = require('/app/packages/backend/dist/database/datasource');
const { encrypt, getEncryptionSecret } = require('/app/packages/backend/dist/common/utils/crypto.util');

const datasource = datasourceModule.default || datasourceModule;
const deployment = process.env.VERTEX_DEPLOYMENT || 'alm-erp/global';

async function main() {
  await datasource.initialize();
  const queryRunner = datasource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    const tenantRows = await queryRunner.query('select id from tenants order by created_at asc limit 1');
    if (tenantRows.length === 0) throw new Error('No tenant exists; complete Manifest setup before Vertex bootstrap');
    const tenantId = tenantRows[0].id;

    const existing = await queryRunner.query(
      `select id from tenant_providers
       where tenant_id = $1 and provider = 'vertex' and auth_type = 'vertex_adc' and label = 'default'
       limit 1`,
      [tenantId],
    );

    let providerId;
    if (existing.length > 0) {
      providerId = existing[0].id;
      await queryRunner.query(
        `update tenant_providers
         set is_active = true, region = $1, updated_at = now()
         where id = $2`,
        [deployment, providerId],
      );
    } else {
      providerId = crypto.randomUUID();
      await queryRunner.query(
        `insert into tenant_providers
          (id, created_by_user_id, provider, api_key_encrypted, is_active,
           connected_at, updated_at, agent_id, key_prefix, auth_type,
           cached_models, models_fetched_at, region, label, priority,
           custom_provider_id, tenant_id)
         values ($1, null, 'vertex', $2, true, now(), now(), null, 'vertex',
                 'vertex_adc', '[]', null, $3, 'default', 0, null, $4)`,
        [providerId, encrypt('vertex_adc', getEncryptionSecret()), deployment, tenantId],
      );
    }

    const agents = await queryRunner.query('select id from agents where tenant_id = $1', [tenantId]);
    for (const agent of agents) {
      await queryRunner.query(
        `insert into agent_enabled_providers (agent_id, tenant_provider_id)
         values ($1, $2) on conflict do nothing`,
        [agent.id, providerId],
      );
    }

    await queryRunner.commitTransaction();
    console.log(JSON.stringify({ provider: 'vertex', auth_type: 'vertex_adc', deployment, enabled_agents: agents.length }));
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
    await datasource.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
