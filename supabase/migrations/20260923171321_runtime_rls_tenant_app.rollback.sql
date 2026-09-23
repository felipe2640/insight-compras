-- Rollback operacional: restaura auditoria/predição ao modo privilegiado.
-- A restrição cross-app de is_tenant_member é uma correção de segurança e
-- permanece ativa; não restaurar a função permissiva anterior.
drop policy if exists auditoria_pedido_insert_own_tenant on public.auditoria_pedido;
revoke insert on public.auditoria_pedido from authenticated;
