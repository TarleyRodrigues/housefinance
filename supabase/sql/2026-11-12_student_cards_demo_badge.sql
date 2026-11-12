-- Carteirinha: opção de mostrar/ocultar o selo "Modelo demonstrativo"
-- null/true = mostra o selo; false = visual igual ao de produção
alter table public.student_cards
  add column if not exists show_demo_badge boolean default true;
