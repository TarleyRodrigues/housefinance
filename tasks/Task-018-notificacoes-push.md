# Task - 018 - Notificações Push

**Status:** PLANEJADO
**Tipo:** Implementação
**Data de criação:** 2026-11-18

## Contexto
Lembretes hoje chegam só por e-mail.

## Objetivo
Push no celular (incluindo iPhone com o app instalado) para lembretes e vencimentos.

## Detalhamento Técnico
- Web Push com VAPID; inscrição salva em tabela `push_subscriptions` (SQL via CLI).
- Envio pela edge function `check-reminders` existente.

## Critérios de Aceitação
- [ ] Permissão e inscrição
- [ ] Push recebido no Android e iOS (PWA instalado)

## Observações para o Claude
Requer chaves VAPID como secret na edge function.
