// ─── AJUSTES DA CARTEIRINHA ──────────────────────────────────────────────────
// Tela cheia com formulário + pré-visualização ao vivo da frente do cartão.
// Começa preenchido com o que já existe no sistema (nome/foto do perfil).

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Loader2, ImagePlus, UserRound, RefreshCw } from 'lucide-react';
import type { EducationLevel, Profile, StudentCard, StudentCardPayload, StudentCardView } from '../types';
import {
  EDUCATION_LEVELS, maskCpf, randomUsageCode, resolveStudentCard,
} from '../utils/studentCard';
import { CardFrame, StudentCardFront } from './StudentCard';

interface StudentCardSettingsProps {
  isOpen: boolean;
  studentCard: StudentCard | null;
  userProfile: Profile | null;
  onClose: () => void;
  onSave: (payload: StudentCardPayload) => Promise<void>;
  onUploadPhoto: (file: File) => Promise<string>;
  showToast: (msg: string, type?: string) => void;
}

const buildForm = (view: StudentCardView, card: StudentCard | null) => ({
  fullName:       view.fullName,
  photoUrl:       card?.photo_url ?? null,  // null = foto do perfil
  cpf:            view.cpf,
  birthDate:      view.birthDate,
  institution:    view.institution,
  course:         view.course,
  educationLevel: view.educationLevel,
  usageCode:      view.usageCode,
  validUntil:     view.validUntil,
  showDemoBadge:  view.showDemoBadge,
});

type CardForm = ReturnType<typeof buildForm>;

const inputCls =
  'w-full min-h-[44px] p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors';
const labelCls = 'block text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5 px-1';

const toNull = (v: string) => (v.trim() === '' ? null : v.trim());

export function StudentCardSettings({
  isOpen, studentCard, userProfile, onClose, onSave, onUploadPhoto, showToast,
}: StudentCardSettingsProps) {
  const userId = userProfile?.id ?? '';
  const [form, setForm]           = useState<CardForm>(() => buildForm(resolveStudentCard(studentCard, userProfile, userId), studentCard));
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);

  // Recarrega o formulário só ao abrir — refetch em segundo plano (realtime)
  // não pode sobrescrever o que está sendo digitado.
  useEffect(() => {
    if (isOpen) setForm(buildForm(resolveStudentCard(studentCard, userProfile, userId), studentCard));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const patch = (partial: Partial<CardForm>) => setForm((f) => ({ ...f, ...partial }));

  const preview = useMemo<StudentCardView>(() => ({
    fullName:       form.fullName.trim() || userProfile?.full_name || 'Nome do Estudante',
    photoUrl:       form.photoUrl || userProfile?.avatar_url || null,
    cpf:            form.cpf,
    birthDate:      form.birthDate,
    institution:    form.institution,
    course:         form.course,
    educationLevel: form.educationLevel,
    usageCode:      form.usageCode.trim() || '—',
    validUntil:     form.validUntil || resolveStudentCard(null, null, userId).validUntil,
    issuedAt:       studentCard?.updated_at ?? new Date().toISOString(),
    showDemoBadge:  form.showDemoBadge,
  }), [form, userProfile, userId, studentCard]);

  const handlePhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Selecione um arquivo de imagem', 'error'); return; }
    setUploading(true);
    try {
      const url = await onUploadPhoto(file);
      patch({ photoUrl: url });
      showToast('Foto carregada — salve para aplicar');
    } catch (err: unknown) {
      console.error('Erro ao enviar foto da carteirinha:', err);
      showToast('Erro ao enviar foto. Tente novamente.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.usageCode.trim()) { showToast('Informe o código de uso', 'error'); return; }
    if (!form.validUntil) { showToast('Informe a validade', 'error'); return; }
    setSaving(true);
    try {
      await onSave({
        // Nome igual ao do perfil não é gravado — continua acompanhando o perfil
        full_name:       form.fullName.trim() === (userProfile?.full_name ?? '') ? null : toNull(form.fullName),
        photo_url:       form.photoUrl,
        cpf:             toNull(form.cpf),
        birth_date:      toNull(form.birthDate),
        institution:     toNull(form.institution),
        course:          toNull(form.course),
        education_level: form.educationLevel,
        usage_code:      form.usageCode.trim().toUpperCase(),
        valid_until:     form.validUntil,
        show_demo_badge: form.showDemoBadge,
      });
      showToast('Carteirinha atualizada!');
      onClose();
    } catch (err: unknown) {
      console.error('Erro ao salvar carteirinha:', err);
      const { code, message } = (err as { code?: string; message?: string }) ?? {};
      showToast(
        code === 'PGRST205' || code === '42P01'
          ? 'Tabela student_cards não existe — rode o SQL no Supabase'
          : code === 'PGRST204' && message?.includes('show_demo_badge')
            ? 'Falta a coluna show_demo_badge — rode o SQL no Supabase'
            : 'Erro ao salvar. Tente novamente.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-[310] flex justify-center"
          role="dialog" aria-modal="true" aria-label="Ajustes da carteirinha"
        >
          <motion.div
            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white dark:bg-slate-800 w-full max-w-md h-full flex flex-col"
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div>
                <p className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight text-sm">Ajustes da Carteirinha</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-0.5">Dados exibidos no cartão</p>
              </div>
              <button onClick={onClose} aria-label="Fechar ajustes"
                className="min-h-[44px] min-w-[44px] rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center active:scale-95 transition-all">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 pt-4 pb-6 space-y-4">
              {/* Pré-visualização */}
              <CardFrame>
                <StudentCardFront data={preview} />
              </CardFrame>

              {/* Foto */}
              <div>
                <span className={labelCls}>Foto da carteirinha</span>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                    {preview.photoUrl
                      ? <img src={preview.photoUrl} alt="Foto atual" className="w-full h-full object-cover" />
                      : <UserRound size={24} className="text-slate-300 dark:text-slate-600" />}
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <label className={`min-h-[44px] rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all shadow-lg shadow-blue-600/20 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                      {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                      {uploading ? 'Enviando...' : 'Escolher imagem'}
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} disabled={uploading} />
                    </label>
                    <button type="button" onClick={() => patch({ photoUrl: null })} disabled={form.photoUrl === null}
                      className="min-h-[44px] rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40">
                      {form.photoUrl === null ? 'Usando foto do perfil' : 'Usar foto do perfil'}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="sc-name" className={labelCls}>Nome</label>
                <input id="sc-name" className={inputCls} value={form.fullName}
                  placeholder={userProfile?.full_name ?? 'Nome completo'}
                  onChange={(e) => patch({ fullName: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sc-cpf" className={labelCls}>CPF</label>
                  <input id="sc-cpf" className={inputCls} inputMode="numeric" placeholder="000.000.000-00"
                    value={form.cpf} onChange={(e) => patch({ cpf: maskCpf(e.target.value) })} />
                </div>
                <div>
                  <label htmlFor="sc-birth" className={labelCls}>Nascimento</label>
                  <input id="sc-birth" type="date" className={inputCls}
                    value={form.birthDate} onChange={(e) => patch({ birthDate: e.target.value })} />
                </div>
              </div>

              <div>
                <label htmlFor="sc-inst" className={labelCls}>Faculdade / Instituição</label>
                <input id="sc-inst" className={inputCls} placeholder="Ex: Universidade Federal de Goiás"
                  value={form.institution} onChange={(e) => patch({ institution: e.target.value })} />
              </div>

              <div>
                <label htmlFor="sc-course" className={labelCls}>Curso</label>
                <input id="sc-course" className={inputCls} placeholder="Ex: Administração"
                  value={form.course} onChange={(e) => patch({ course: e.target.value })} />
              </div>

              <div>
                <label htmlFor="sc-level" className={labelCls}>Nível de ensino</label>
                <select id="sc-level" className={inputCls} value={form.educationLevel}
                  onChange={(e) => patch({ educationLevel: e.target.value as EducationLevel })}>
                  {EDUCATION_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sc-code" className={labelCls}>Código de uso</label>
                  <div className="relative">
                    <input id="sc-code" className={`${inputCls} pr-12 uppercase tracking-wider`} maxLength={16}
                      value={form.usageCode} onChange={(e) => patch({ usageCode: e.target.value.toUpperCase() })} />
                    <button type="button" onClick={() => patch({ usageCode: randomUsageCode() })} aria-label="Gerar novo código"
                      className="absolute right-0 top-0 h-full min-w-[44px] flex items-center justify-center text-blue-600 dark:text-blue-400 active:scale-90 transition-all">
                      <RefreshCw size={16} />
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="sc-valid" className={labelCls}>Validade</label>
                  <input id="sc-valid" type="date" className={inputCls}
                    value={form.validUntil} onChange={(e) => patch({ validUntil: e.target.value })} />
                </div>
              </div>

              {/* Selo "Modelo demonstrativo" */}
              <button type="button" role="switch" aria-checked={form.showDemoBadge}
                onClick={() => patch({ showDemoBadge: !form.showDemoBadge })}
                className="w-full min-h-[44px] p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 text-left active:scale-[0.98] transition-all">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Selo "Modelo demonstrativo"</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    {form.showDemoBadge ? 'Visível na frente e no verso' : 'Oculto — visual igual ao de produção'}
                  </p>
                </div>
                <span className={`relative w-12 h-7 rounded-full shrink-0 transition-colors ${form.showDemoBadge ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.showDemoBadge ? 'translate-x-5' : ''}`} />
                </span>
              </button>

              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed px-1">
                QR Code ilustrativo, gerado a partir do código de uso. A integração com a entidade emissora
                substituirá por um certificado real.
              </p>
            </div>

            <div className="px-5 pb-6 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button onClick={handleSave} disabled={saving || uploading}
                className="w-full min-h-[48px] rounded-2xl bg-emerald-500 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? 'Salvando...' : 'Salvar carteirinha'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
