import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CloudDownload, Flag, Plus, Printer, Trophy } from 'lucide-react'
import { useToast } from '../components/ui/Toast'
import { usePermissions } from '../hooks/usePermissions'
import { callApi } from '../lib/api-client'
import { formatMoney } from '../services/currency'

type Tab = 'carreras' | 'caballos' | 'propietarios' | 'resultados' | 'apuestas'

interface Propietario {
  id: number
  nombre: string
  documento: string | null
  telefono: string | null
  email: string | null
  pais: string | null
  caballos: number
}

interface Caballo {
  id: number
  nombre: string
  raza: string | null
  sexo: string | null
  anio_nacimiento: number | null
  propietario_id: number | null
  propietario_nombre: string | null
  microchip: string | null
  entrenador: string | null
  victorias: number
  carreras_corridas: number
}

interface Carrera {
  id: number
  hipodromo: string
  fecha: string
  numero_carrera: number
  distancia_m: number | null
  categoria: string | null
  premio: number | null
  estado: string
  fuente: string
  inscriptos: number
  resultados: number
}

interface Inscripcion {
  id: number
  caballo_id: number
  caballo_nombre: string
  raza: string | null
  propietario_nombre: string | null
  jinete: string | null
  numero_partida: number | null
  retirado: number
  posicion: number | null
  tiempo: string | null
  dividendo: number | null
}

interface Resultado {
  id: number
  carrera_id: number
  caballo_nombre: string
  hipodromo: string
  fecha: string
  numero_carrera: number
  posicion: number
  tiempo: string | null
  dividendo: number | null
  fuente: string
}

interface Stats {
  caballos: number
  propietarios: number
  carreras_programadas: number
  carreras_hoy: number
  inscriptos: number
  top_ganadores: Array<{ id: number; nombre: string; victorias: number }>
}

interface Apuesta {
  id: number
  numero_ticket: string
  carrera_id: number
  tipo_apuesta: string
  monto: number
  odd_total: number
  payout_potencial: number
  estado: string
  ganancia: number | null
  notas: string | null
  creado_en: string
  cerrada_en: string | null
  hipodromo: string
  fecha: string
  numero_carrera: number
  selecciones: number
}

interface ApuestaDetalle {
  apuesta: Apuesta & { carrera_estado: string }
  selections: Array<{
    id: number
    apuesta_id: number
    carrera_id: number
    caballo_nombre: string
    caballo_numero: number | null
    posicion_predicha: number | null
    odd_individual: number | null
    resultado_posicion: number | null
    ganador: number
  }>
}

interface ApuestasStats {
  pendientes: number
  pendientes_monto: number
  hoy: number
  hoy_monto: number
  ganadas: number
  total_ganado: number
  total_apuestas: number
  total_monto: number
}

const ESTADOS = ['programada', 'en_curso', 'finalizada', 'cancelada']
const SEXOS = ['macho', 'hembra']

export default function HipicoPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { has } = usePermissions()
  const [tab, setTab] = useState<Tab>('carreras')
  const [stats, setStats] = useState<Stats | null>(null)
  const [carreras, setCarreras] = useState<Carrera[]>([])
  const [caballos, setCaballos] = useState<Caballo[]>([])
  const [propietarios, setPropietarios] = useState<Propietario[]>([])
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [filtroEstado, setFiltroEstado] = useState('')
  const [loading, setLoading] = useState(false)

  const [modalCarrera, setModalCarrera] = useState(false)
  const [modalCaballo, setModalCaballo] = useState(false)
  const [modalPropietario, setModalPropietario] = useState(false)
  const [modalInscripciones, setModalInscripciones] = useState<Carrera | null>(null)
  const [modalImportar, setModalImportar] = useState(false)
  const [modalApuesta, setModalApuesta] = useState(false)
  const [modalDetalleApuesta, setModalDetalleApuesta] = useState<ApuestaDetalle | null>(null)

  const [apuestas, setApuestas] = useState<Apuesta[]>([])
  const [apuestasStats, setApuestasStats] = useState<ApuestasStats | null>(null)
  const [filtroApuestaEstado, setFiltroApuestaEstado] = useState('')

  const puedeEditar = has('hipico_edit')
  const puedeApuestas = has('hipico_apuestas')
  const puedeApuestasAdmin = has('hipico_apuestas_admin')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [st, ca, cb, pr, rs] = await Promise.all([
        callApi<Stats>('hipico:stats', {}),
        callApi<Carrera[]>('hipico:carreras-list', filtroEstado ? { estado: filtroEstado } : {}),
        callApi<Caballo[]>('hipico:caballos-list', {}),
        callApi<Propietario[]>('hipico:propietarios-list', {}),
        callApi<Resultado[]>('hipico:resultados-list', {}),
      ])
      setStats(st)
      setCarreras(ca || [])
      setCaballos(cb || [])
      setPropietarios(pr || [])
      setResultados(rs || [])
      if (puedeApuestas) {
        const [ap, apSt] = await Promise.all([
          callApi<Apuesta[]>('hipico:apuestas-list', filtroApuestaEstado ? { estado: filtroApuestaEstado } : {}),
          callApi<ApuestasStats>('hipico:apuestas-stats', {}),
        ])
        setApuestas(ap || [])
        setApuestasStats(apSt)
      }
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [filtroEstado, filtroApuestaEstado, puedeApuestas, t, toast])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (tab === 'apuestas' && !puedeApuestas) setTab('carreras')
  }, [tab, puedeApuestas])

  const estadoBadge = (estado: string) => {
    const styles: Record<string, string> = {
      programada: 'bg-blue-100 text-blue-700',
      en_curso: 'bg-orange-100 text-orange-700',
      finalizada: 'bg-green-100 text-green-700',
      cancelada: 'bg-gray-100 text-gray-500',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[estado] || 'bg-gray-100 text-gray-600'}`}>
        {t(`hipico.estado.${estado}`, { defaultValue: estado })}
      </span>
    )
  }

  const verDetalle = async (apuesta: Apuesta) => {
    try {
      const detalle = await callApi<ApuestaDetalle>('hipico:apuesta-detail', { apuesta_id: apuesta.id })
      if (detalle) setModalDetalleApuesta(detalle)
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const imprimirApuesta = async (apuesta: Apuesta, reimprimir = false) => {
    try {
      await callApi('print:ticket-apuesta', { apuesta_id: apuesta.id, reimprimir })
      toast.success(t('hipico.apuestas.printed'))
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const anularApuesta = async (apuesta: Apuesta) => {
    if (!window.confirm(t('hipico.apuestas.confirmVoid', { ticket: apuesta.numero_ticket }))) return
    try {
      await callApi('hipico:apuesta-anular', { apuesta_id: apuesta.id })
      toast.success(t('hipico.apuestas.voided'))
      await load()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const liquidarCarrera = async (apuesta: Apuesta) => {
    if (!window.confirm(t('hipico.apuestas.confirmSettle'))) return
    try {
      const res = await callApi<{ liquidadas: number; ganadas: number; perdidas: number }>('hipico:apuestas-liquidar', {
        carrera_id: apuesta.carrera_id,
      })
      if (!res?.liquidadas) toast.info(t('hipico.apuestas.settleNothing'))
      else toast.success(t('hipico.apuestas.settled', { ganadas: res.ganadas, perdidas: res.perdidas }))
      await load()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('hipico.title')}</h1>
          <p className="text-sm text-gray-500">{t('hipico.subtitle')}</p>
        </div>
        {puedeEditar && (
          <div className="flex gap-2">
            <button
              onClick={() => setModalImportar(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100"
            >
              <CloudDownload className="w-4 h-4" /> {t('hipico.importApi')}
            </button>
            {tab === 'carreras' && (
              <button
                onClick={() => setModalCarrera(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700"
              >
                <Plus className="w-4 h-4" /> {t('hipico.newCarrera')}
              </button>
            )}
            {tab === 'caballos' && (
              <button
                onClick={() => setModalCaballo(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700"
              >
                <Plus className="w-4 h-4" /> {t('hipico.newCaballo')}
              </button>
            )}
            {tab === 'propietarios' && (
              <button
                onClick={() => setModalPropietario(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700"
              >
                <Plus className="w-4 h-4" /> {t('hipico.newPropietario')}
              </button>
            )}
            {tab === 'apuestas' && puedeApuestas && (
              <button
                onClick={() => setModalApuesta(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700"
              >
                <Plus className="w-4 h-4" /> {t('hipico.apuestas.newBet')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card icon={Trophy} label={t('hipico.statHorses')} value={String(stats?.caballos ?? 0)} color="amber" />
        <Card icon={Flag} label={t('hipico.statRacesProgrammed')} value={String(stats?.carreras_programadas ?? 0)} color="blue" />
        <Card icon={Flag} label={t('hipico.statRacesToday')} value={String(stats?.carreras_hoy ?? 0)} color="green" />
        <Card icon={Trophy} label={t('hipico.statEntries')} value={String(stats?.inscriptos ?? 0)} color="purple" />
      </div>

      {stats && stats.top_ganadores.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('hipico.topWinners')}</h2>
          <div className="flex flex-wrap gap-2">
            {stats.top_ganadores.map((c, i) => (
              <span key={c.id} className="px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                {i + 1}. {c.nombre} — {c.victorias} 🏆
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200">
        {(['carreras', 'caballos', 'propietarios', 'resultados', ...(puedeApuestas ? ['apuestas' as Tab] : [])] as Tab[]).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(`hipico.tab.${id}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
        </div>
      ) : tab === 'carreras' ? (
        <>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">{t('hipico.allStatuses')}</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {t(`hipico.estado.${e}`)}
              </option>
            ))}
          </select>
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <Th>{t('hipico.colDate')}</Th>
                  <Th>{t('hipico.colRacetrack')}</Th>
                  <Th right>{t('hipico.colRaceNumber')}</Th>
                  <Th right>{t('hipico.colDistance')}</Th>
                  <Th>{t('hipico.colCategory')}</Th>
                  <Th right>{t('hipico.colPrize')}</Th>
                  <Th right>{t('hipico.colEntries')}</Th>
                  <Th>{t('contable.colStatus')}</Th>
                  <Th right>{t('common.actions')}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {carreras.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-gray-400">
                      {t('hipico.noCarreras')}
                    </td>
                  </tr>
                ) : (
                  carreras.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">{c.fecha?.slice(0, 10)}</td>
                      <td className="px-3 py-2 font-medium">
                        {c.hipodromo}
                        {c.fuente === 'api' && <span className="ml-2 text-xs text-purple-500">{t('hipico.fromApi')}</span>}
                      </td>
                      <td className="px-3 py-2 text-right">#{c.numero_carrera}</td>
                      <td className="px-3 py-2 text-right">{c.distancia_m ? `${c.distancia_m} m` : '—'}</td>
                      <td className="px-3 py-2 text-gray-500">{c.categoria || '—'}</td>
                      <td className="px-3 py-2 text-right">{c.premio ? formatMoney(c.premio) : '—'}</td>
                      <td className="px-3 py-2 text-right">{c.inscriptos}</td>
                      <td className="px-3 py-2">{estadoBadge(c.estado)}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => setModalInscripciones(c)} className="text-amber-600 hover:underline text-sm">
                          {t('hipico.manageEntries')}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : tab === 'caballos' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>{t('hipico.colHorse')}</Th>
                <Th>{t('hipico.colBreed')}</Th>
                <Th>{t('hipico.colSex')}</Th>
                <Th right>{t('hipico.colBirthYear')}</Th>
                <Th>{t('hipico.colOwner')}</Th>
                <Th>{t('hipico.colTrainer')}</Th>
                <Th right>{t('hipico.colRuns')}</Th>
                <Th right>{t('hipico.colWins')}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {caballos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-400">
                    {t('hipico.noCaballos')}
                  </td>
                </tr>
              ) : (
                caballos.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{c.nombre}</td>
                    <td className="px-3 py-2 text-gray-500">{c.raza || '—'}</td>
                    <td className="px-3 py-2">{c.sexo ? t(`hipico.sexo.${c.sexo}`) : '—'}</td>
                    <td className="px-3 py-2 text-right">{c.anio_nacimiento || '—'}</td>
                    <td className="px-3 py-2">{c.propietario_nombre || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{c.entrenador || '—'}</td>
                    <td className="px-3 py-2 text-right">{c.carreras_corridas}</td>
                    <td className="px-3 py-2 text-right font-semibold text-amber-700">{c.victorias}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : tab === 'propietarios' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>{t('hipico.colOwner')}</Th>
                <Th>{t('hipico.colDocument')}</Th>
                <Th>{t('hipico.colPhone')}</Th>
                <Th>{t('hipico.colEmail')}</Th>
                <Th>{t('hipico.colCountry')}</Th>
                <Th right>{t('hipico.colHorses')}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {propietarios.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    {t('hipico.noPropietarios')}
                  </td>
                </tr>
              ) : (
                propietarios.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{p.nombre}</td>
                    <td className="px-3 py-2">{p.documento || '—'}</td>
                    <td className="px-3 py-2">{p.telefono || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{p.email || '—'}</td>
                    <td className="px-3 py-2">{p.pais || '—'}</td>
                    <td className="px-3 py-2 text-right">{p.caballos}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : tab === 'apuestas' ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card icon={Trophy} label={t('hipico.apuestas.statPending')} value={`${apuestasStats?.pendientes ?? 0} (${formatMoney(apuestasStats?.pendientes_monto ?? 0)})`} color="blue" />
            <Card icon={Flag} label={t('hipico.apuestas.statToday')} value={`${apuestasStats?.hoy ?? 0} (${formatMoney(apuestasStats?.hoy_monto ?? 0)})`} color="green" />
            <Card icon={Trophy} label={t('hipico.apuestas.statWon')} value={`${apuestasStats?.ganadas ?? 0} (${formatMoney(apuestasStats?.total_ganado ?? 0)})`} color="amber" />
            <Card icon={Flag} label={t('hipico.apuestas.statTotal')} value={`${apuestasStats?.total_apuestas ?? 0} (${formatMoney(apuestasStats?.total_monto ?? 0)})`} color="purple" />
          </div>

          <select
            value={filtroApuestaEstado}
            onChange={(e) => setFiltroApuestaEstado(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">{t('hipico.allStatuses')}</option>
            <option value="pendiente">{t('hipico.apuestas.estado.pendiente')}</option>
            <option value="ganada">{t('hipico.apuestas.estado.ganada')}</option>
            <option value="perdida">{t('hipico.apuestas.estado.perdida')}</option>
            <option value="anulada">{t('hipico.apuestas.estado.anulada')}</option>
          </select>

          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <Th>{t('hipico.apuestas.colTicket')}</Th>
                  <Th>{t('hipico.colDate')}</Th>
                  <Th>{t('hipico.colRacetrack')}</Th>
                  <Th right>{t('hipico.colRaceNumber')}</Th>
                  <Th>{t('hipico.apuestas.colType')}</Th>
                  <Th right>{t('hipico.apuestas.colSelections')}</Th>
                  <Th right>{t('hipico.apuestas.colAmount')}</Th>
                  <Th right>{t('hipico.apuestas.colOdds')}</Th>
                  <Th right>{t('hipico.apuestas.colPayout')}</Th>
                  <Th>{t('contable.colStatus')}</Th>
                  <Th right>{t('common.actions')}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {apuestas.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-10 text-gray-400">
                      {t('hipico.apuestas.noApuestas')}
                    </td>
                  </tr>
                ) : (
                  apuestas.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">{a.numero_ticket}</td>
                      <td className="px-3 py-2">{a.creado_en?.slice(0, 10)}</td>
                      <td className="px-3 py-2">{a.hipodromo}</td>
                      <td className="px-3 py-2 text-right">#{a.numero_carrera}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          {t(`hipico.apuestas.tipo.${a.tipo_apuesta}`, { defaultValue: a.tipo_apuesta })}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{a.selecciones}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(a.monto)}</td>
                      <td className="px-3 py-2 text-right">{a.odd_total?.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(a.payout_potencial)}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          a.estado === 'ganada' ? 'bg-green-100 text-green-700' :
                          a.estado === 'perdida' ? 'bg-red-100 text-red-700' :
                          a.estado === 'anulada' ? 'bg-gray-100 text-gray-500' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {t(`hipico.apuestas.estado.${a.estado}`, { defaultValue: a.estado })}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-3 text-sm">
                          <button onClick={() => verDetalle(a)} className="text-amber-600 hover:underline">
                            {t('common.view')}
                          </button>
                          {puedeApuestas && (
                            <button onClick={() => imprimirApuesta(a, a.estado !== 'pendiente')} className="text-gray-600 hover:underline">
                              {t('common.print')}
                            </button>
                          )}
                          {puedeApuestasAdmin && a.estado === 'pendiente' && (
                            <>
                              <button onClick={() => liquidarCarrera(a)} className="text-blue-600 hover:underline">
                                {t('hipico.apuestas.settle')}
                              </button>
                              <button onClick={() => anularApuesta(a)} className="text-red-600 hover:underline">
                                {t('hipico.apuestas.void')}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>{t('hipico.colDate')}</Th>
                <Th>{t('hipico.colRacetrack')}</Th>
                <Th right>{t('hipico.colRaceNumber')}</Th>
                <Th right>{t('hipico.colPosition')}</Th>
                <Th>{t('hipico.colHorse')}</Th>
                <Th>{t('hipico.colTime')}</Th>
                <Th right>{t('hipico.colDividend')}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {resultados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    {t('hipico.noResultados')}
                  </td>
                </tr>
              ) : (
                resultados.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{r.fecha?.slice(0, 10)}</td>
                    <td className="px-3 py-2">{r.hipodromo}</td>
                    <td className="px-3 py-2 text-right">#{r.numero_carrera}</td>
                    <td className="px-3 py-2 text-right font-semibold">{r.posicion}º</td>
                    <td className="px-3 py-2">{r.caballo_nombre}</td>
                    <td className="px-3 py-2 text-gray-500">{r.tiempo || '—'}</td>
                    <td className="px-3 py-2 text-right">{r.dividendo ? formatMoney(r.dividendo) : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalCarrera && <ModalCarrera onClose={() => setModalCarrera(false)} onSaved={async () => { setModalCarrera(false); await load() }} />}
      {modalCaballo && (
        <ModalCaballo
          propietarios={propietarios}
          onClose={() => setModalCaballo(false)}
          onSaved={async () => { setModalCaballo(false); await load() }}
        />
      )}
      {modalPropietario && (
        <ModalPropietario onClose={() => setModalPropietario(false)} onSaved={async () => { setModalPropietario(false); await load() }} />
      )}
      {modalInscripciones && (
        <ModalInscripciones
          carrera={modalInscripciones}
          caballos={caballos}
          puedeEditar={puedeEditar}
          onClose={() => setModalInscripciones(null)}
          onSaved={load}
        />
      )}
      {modalImportar && <ModalImportar onClose={() => setModalImportar(false)} onSaved={async () => { setModalImportar(false); await load() }} />}
      {modalApuesta && (
        <ModalApuesta
          carreras={carreras}
          onClose={() => setModalApuesta(false)}
          onSaved={async () => { setModalApuesta(false); await load() }}
        />
      )}
      {modalDetalleApuesta && (
        <ModalDetalleApuesta
          detalle={modalDetalleApuesta}
          onPrint={
            puedeApuestas
              ? () => imprimirApuesta(modalDetalleApuesta.apuesta, modalDetalleApuesta.apuesta.estado !== 'pendiente')
              : undefined
          }
          onClose={() => setModalDetalleApuesta(null)}
        />
      )}
    </div>
  )
}

function ModalCarrera({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [hipodromo, setHipodromo] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [numero, setNumero] = useState('1')
  const [distancia, setDistancia] = useState('')
  const [categoria, setCategoria] = useState('')
  const [premio, setPremio] = useState('')
  const [saving, setSaving] = useState(false)

  const guardar = async () => {
    setSaving(true)
    try {
      await callApi('hipico:carreras-create', {
        hipodromo,
        fecha,
        numero_carrera: Number(numero),
        distancia_m: distancia ? Number(distancia) : undefined,
        categoria: categoria || undefined,
        premio: premio ? Number(premio) : undefined,
      })
      toast.success(t('hipico.carreraCreated'))
      onSaved()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={t('hipico.newCarrera')} onClose={onClose} onSave={guardar} saving={saving} disabled={!hipodromo.trim()}>
      <input value={hipodromo} onChange={(e) => setHipodromo(e.target.value)} placeholder={t('hipico.colRacetrack')} className={inputCls} />
      <div className="grid grid-cols-2 gap-3">
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
        <input type="number" min="1" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder={t('hipico.colRaceNumber')} className={inputCls} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <input type="number" min="0" value={distancia} onChange={(e) => setDistancia(e.target.value)} placeholder={`${t('hipico.colDistance')} (m)`} className={inputCls} />
        <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder={t('hipico.colCategory')} className={inputCls} />
        <input type="number" min="0" value={premio} onChange={(e) => setPremio(e.target.value)} placeholder={t('hipico.colPrize')} className={inputCls} />
      </div>
    </Modal>
  )
}

function ModalPropietario({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [nombre, setNombre] = useState('')
  const [documento, setDocumento] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [pais, setPais] = useState('')
  const [saving, setSaving] = useState(false)

  const guardar = async () => {
    setSaving(true)
    try {
      await callApi('hipico:propietarios-create', {
        nombre,
        documento: documento || undefined,
        telefono: telefono || undefined,
        email: email || undefined,
        pais: pais || undefined,
      })
      toast.success(t('hipico.propietarioCreated'))
      onSaved()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={t('hipico.newPropietario')} onClose={onClose} onSave={guardar} saving={saving} disabled={!nombre.trim()}>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t('hipico.colOwner')} className={inputCls} />
      <div className="grid grid-cols-2 gap-3">
        <input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder={t('hipico.colDocument')} className={inputCls} />
        <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder={t('hipico.colPhone')} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('hipico.colEmail')} className={inputCls} />
        <input value={pais} onChange={(e) => setPais(e.target.value)} placeholder={t('hipico.colCountry')} className={inputCls} />
      </div>
    </Modal>
  )
}

function ModalCaballo({
  propietarios,
  onClose,
  onSaved,
}: {
  propietarios: Propietario[]
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [nombre, setNombre] = useState('')
  const [raza, setRaza] = useState('')
  const [sexo, setSexo] = useState('')
  const [anio, setAnio] = useState('')
  const [propietarioId, setPropietarioId] = useState('')
  const [entrenador, setEntrenador] = useState('')
  const [microchip, setMicrochip] = useState('')
  const [saving, setSaving] = useState(false)

  const guardar = async () => {
    setSaving(true)
    try {
      await callApi('hipico:caballos-create', {
        nombre,
        raza: raza || undefined,
        sexo: sexo || undefined,
        anio_nacimiento: anio ? Number(anio) : undefined,
        propietario_id: propietarioId ? Number(propietarioId) : undefined,
        entrenador: entrenador || undefined,
        microchip: microchip || undefined,
      })
      toast.success(t('hipico.caballoCreated'))
      onSaved()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={t('hipico.newCaballo')} onClose={onClose} onSave={guardar} saving={saving} disabled={!nombre.trim()}>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t('hipico.colHorse')} className={inputCls} />
      <div className="grid grid-cols-2 gap-3">
        <input value={raza} onChange={(e) => setRaza(e.target.value)} placeholder={t('hipico.colBreed')} className={inputCls} />
        <select value={sexo} onChange={(e) => setSexo(e.target.value)} className={inputCls}>
          <option value="">{t('hipico.colSex')}</option>
          {SEXOS.map((s) => (
            <option key={s} value={s}>
              {t(`hipico.sexo.${s}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input type="number" value={anio} onChange={(e) => setAnio(e.target.value)} placeholder={t('hipico.colBirthYear')} className={inputCls} />
        <select value={propietarioId} onChange={(e) => setPropietarioId(e.target.value)} className={inputCls}>
          <option value="">{t('hipico.colOwner')}</option>
          {propietarios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input value={entrenador} onChange={(e) => setEntrenador(e.target.value)} placeholder={t('hipico.colTrainer')} className={inputCls} />
        <input value={microchip} onChange={(e) => setMicrochip(e.target.value)} placeholder={t('hipico.colMicrochip')} className={inputCls} />
      </div>
    </Modal>
  )
}

function ModalInscripciones({
  carrera,
  caballos,
  puedeEditar,
  onClose,
  onSaved,
}: {
  carrera: Carrera
  caballos: Caballo[]
  puedeEditar: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([])
  const [loading, setLoading] = useState(true)
  const [caballoId, setCaballoId] = useState('')
  const [jinete, setJinete] = useState('')
  const [posiciones, setPosiciones] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)

  const loadInscripciones = async () => {
    setLoading(true)
    try {
      const rows = await callApi<Inscripcion[]>('hipico:inscripciones-list', { carrera_id: carrera.id })
      setInscripciones(rows || [])
      const iniciales: Record<number, string> = {}
      for (const i of rows || []) iniciales[i.id] = i.posicion ? String(i.posicion) : ''
      setPosiciones(iniciales)
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInscripciones()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrera.id])

  const inscribir = async () => {
    if (!caballoId) return
    setSaving(true)
    try {
      await callApi('hipico:inscripciones-create', {
        carrera_id: carrera.id,
        caballo_id: Number(caballoId),
        jinete: jinete || undefined,
      })
      setCaballoId('')
      setJinete('')
      await loadInscripciones()
      onSaved()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const retirar = async (insc: Inscripcion, retirado: boolean) => {
    try {
      await callApi('hipico:inscripciones-retirar', { id: insc.id, retirado })
      await loadInscripciones()
      onSaved()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const guardarResultado = async (insc: Inscripcion) => {
    const posicion = Number(posiciones[insc.id])
    if (!Number.isInteger(posicion) || posicion < 1) return
    try {
      const res = await callApi<{ success: boolean; carrera_finalizada?: boolean }>('hipico:resultado-set', {
        inscripcion_id: insc.id,
        posicion,
      })
      toast.success(res?.carrera_finalizada ? t('hipico.raceFinished') : t('hipico.resultSaved'))
      await loadInscripciones()
      onSaved()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const activos = inscripciones.filter((i) => !i.retirado)

  return (
    <Modal
      title={`${carrera.hipodromo} #${carrera.numero_carrera} — ${carrera.fecha?.slice(0, 10)}`}
      onClose={onClose}
      onSave={onClose}
      saving={false}
      saveLabel={t('common.close')}
      wide
    >
      {puedeEditar && carrera.estado !== 'finalizada' && carrera.estado !== 'cancelada' && (
        <div className="flex gap-2 items-end">
          <select value={caballoId} onChange={(e) => setCaballoId(e.target.value)} className={inputCls}>
            <option value="">{t('hipico.chooseHorse')}</option>
            {caballos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <input value={jinete} onChange={(e) => setJinete(e.target.value)} placeholder={t('hipico.colJockey')} className={inputCls} />
          <button
            onClick={inscribir}
            disabled={saving || !caballoId}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 whitespace-nowrap"
          >
            {t('hipico.enter')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full" />
        </div>
      ) : activos.length === 0 ? (
        <p className="text-center py-8 text-gray-400 text-sm">{t('hipico.noEntries')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th right>{t('hipico.colStartNumber')}</Th>
              <Th>{t('hipico.colHorse')}</Th>
              <Th>{t('hipico.colOwner')}</Th>
              <Th>{t('hipico.colJockey')}</Th>
              <Th right>{t('hipico.colPosition')}</Th>
              {puedeEditar && <Th right>{t('common.actions')}</Th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {activos.map((i) => (
              <tr key={i.id}>
                <td className="px-2 py-2 text-right">{i.numero_partida ?? '—'}</td>
                <td className="px-2 py-2 font-medium">{i.caballo_nombre}</td>
                <td className="px-2 py-2 text-gray-500">{i.propietario_nombre || '—'}</td>
                <td className="px-2 py-2 text-gray-500">{i.jinete || '—'}</td>
                <td className="px-2 py-2 text-right">
                  {puedeEditar ? (
                    <input
                      type="number"
                      min="1"
                      value={posiciones[i.id] ?? ''}
                      onChange={(e) => setPosiciones({ ...posiciones, [i.id]: e.target.value })}
                      onBlur={() => guardarResultado(i)}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                    />
                  ) : (
                    i.posicion ?? '—'
                  )}
                </td>
                {puedeEditar && (
                  <td className="px-2 py-2 text-right">
                    <button onClick={() => retirar(i, true)} className="text-red-600 hover:underline text-xs">
                      {t('hipico.withdraw')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {puedeEditar && inscripciones.some((i) => i.retirado) && (
        <div className="text-xs text-gray-400">
          {t('hipico.withdrawnList')}:{' '}
          {inscripciones
            .filter((i) => i.retirado)
            .map((i) => (
              <button key={i.id} onClick={() => retirar(i, false)} className="text-amber-600 hover:underline mr-2">
                {i.caballo_nombre} ↺
              </button>
            ))}
        </div>
      )}
    </Modal>
  )
}

function ModalImportar({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [url, setUrl] = useState('')
  const [guardadas, setGuardadas] = useState<number | null>(null)
  const [descartadas, setDescartadas] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    callApi<{ url: string }>('hipico:api-config', {})
      .then((res) => setUrl(res?.url || ''))
      .catch(() => undefined)
  }, [])

  const importar = async () => {
    setSaving(true)
    try {
      const res = await callApi<{ success: boolean; guardadas?: number; descartadas?: number; error?: string }>('hipico:api-importar', { url })
      if (!res?.success) throw new Error(res?.error || t('common.error'))
      setGuardadas(res.guardadas ?? 0)
      setDescartadas(res.descartadas ?? 0)
      toast.success(t('hipico.imported', { count: res.guardadas ?? 0 }))
      onSaved()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={t('hipico.importApi')}
      onClose={onClose}
      onSave={importar}
      saving={saving}
      disabled={!/^https?:\/\//i.test(url.trim())}
      saveLabel={t('hipico.import')}
      wide
    >
      <p className="text-xs text-gray-500">{t('hipico.importHelp')}</p>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hipica.example.com/api/carreras" className={inputCls} />
      {guardadas !== null && (
        <p className="text-sm text-green-700">{t('hipico.importResult', { saved: guardadas, skipped: descartadas })}</p>
      )}
    </Modal>
  )
}

const TIPOS_APUESTA = ['win', 'place', 'each_way', 'exacta', 'trifecta']

function ModalApuesta({ carreras, onClose, onSaved }: { carreras: Carrera[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [carreraId, setCarreraId] = useState<number | ''>('')
  const [tipo, setTipo] = useState('win')
  const [monto, setMonto] = useState('')
  const [notas, setNotas] = useState('')
  const [selections, setSelections] = useState<Array<{
    caballo_nombre: string
    caballo_numero: string
    posicion_predicha: string
    odd_individual: string
  }>>([{ caballo_nombre: '', caballo_numero: '', posicion_predicha: '', odd_individual: '' }])
  const [saving, setSaving] = useState(false)

  const addSelection = () => {
    setSelections([...selections, { caballo_nombre: '', caballo_numero: '', posicion_predicha: '', odd_individual: '' }])
  }

  const removeSelection = (idx: number) => {
    setSelections(selections.filter((_, i) => i !== idx))
  }

  const updateSelection = (idx: number, field: string, value: string) => {
    const updated = [...selections]
    updated[idx] = { ...updated[idx], [field]: value }
    setSelections(updated)
  }

  const oddTotal = selections.reduce((acc, s) => {
    const odd = parseFloat(s.odd_individual)
    return isNaN(odd) ? acc : acc * odd
  }, 1)

  const payoutPotencial = (parseFloat(monto) || 0) * oddTotal

  const guardar = async () => {
    if (!carreraId) return
    setSaving(true)
    try {
      const res = await callApi<{ success: boolean; error?: string; numero_ticket?: string }>('hipico:apuesta-crear', {
        carrera_id: carreraId,
        tipo_apuesta: tipo,
        monto: parseFloat(monto),
        notas: notas || undefined,
        selections: selections.map((s) => ({
          caballo_nombre: s.caballo_nombre,
          caballo_numero: s.caballo_numero ? parseInt(s.caballo_numero) : null,
          posicion_predicha: s.posicion_predicha ? parseInt(s.posicion_predicha) : null,
          odd_individual: s.odd_individual ? parseFloat(s.odd_individual) : null,
        })),
      })
      if (!res?.success) throw new Error(res?.error || t('common.error'))
      toast.success(t('hipico.apuestas.created', { ticket: res.numero_ticket }))
      onSaved()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={t('hipico.apuestas.newBet')}
      onClose={onClose}
      onSave={guardar}
      saving={saving}
      disabled={!carreraId || !monto || parseFloat(monto) <= 0}
      wide
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('hipico.colRace')}</label>
            <select value={carreraId} onChange={(e) => setCarreraId(e.target.value ? Number(e.target.value) : '')} className={inputCls}>
              <option value="">{t('hipico.apuestas.selectRace')}</option>
              {carreras.filter((c) => c.estado !== 'finalizada' && c.estado !== 'cancelada').map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fecha?.slice(0, 10)} — {c.hipodromo} #{c.numero_carrera}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('hipico.apuestas.colType')}</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
              {TIPOS_APUESTA.map((tp) => (
                <option key={tp} value={tp}>{t(`hipico.apuestas.tipo.${tp}`, { defaultValue: tp })}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('hipico.apuestas.colAmount')}</label>
            <input type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" className={inputCls} />
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">{t('hipico.apuestas.odds')}</p>
            <p className="text-lg font-bold text-amber-600">{oddTotal.toFixed(2)}</p>
            <p className="text-xs text-gray-500">{t('hipico.apuestas.potentialPayout')}</p>
            <p className="text-sm font-semibold">{formatMoney(payoutPotencial)}</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">{t('hipico.apuestas.selections')}</label>
            <button onClick={addSelection} className="text-xs text-amber-600 hover:underline">+ {t('hipico.apuestas.addSelection')}</button>
          </div>
          <div className="space-y-2">
            {selections.map((s, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  value={s.caballo_nombre}
                  onChange={(e) => updateSelection(idx, 'caballo_nombre', e.target.value)}
                  placeholder={t('hipico.colHorse')}
                  className={`flex-1 ${inputCls}`}
                />
                <input
                  value={s.caballo_numero}
                  onChange={(e) => updateSelection(idx, 'caballo_numero', e.target.value)}
                  placeholder={t('hipico.colStartNumber')}
                  className={`w-16 ${inputCls}`}
                />
                <input
                  value={s.odd_individual}
                  onChange={(e) => updateSelection(idx, 'odd_individual', e.target.value)}
                  placeholder={t('hipico.apuestas.colOdds')}
                  className={`w-20 ${inputCls}`}
                />
                {(tipo === 'exacta' || tipo === 'trifecta') && (
                  <input
                    value={s.posicion_predicha}
                    onChange={(e) => updateSelection(idx, 'posicion_predicha', e.target.value)}
                    placeholder={t('hipico.apuestas.colPosition')}
                    className={`w-16 ${inputCls}`}
                  />
                )}
                {selections.length > 1 && (
                  <button onClick={() => removeSelection(idx)} className="text-red-500 hover:text-red-700 text-sm">✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{t('common.notes')}</label>
          <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={t('common.notes')} className={inputCls} />
        </div>
      </div>
    </Modal>
  )
}

function ModalDetalleApuesta({
  detalle,
  onPrint,
  onClose,
}: {
  detalle: ApuestaDetalle
  onPrint?: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { apuesta, selections } = detalle

  return (
    <Modal title={t('hipico.apuestas.ticketDetail')} onClose={onClose} onSave={onClose} saving={false} saveLabel={t('common.close')} wide>
      <div className="space-y-3">
        {onPrint && (
          <button
            onClick={onPrint}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800"
          >
            <Printer className="w-4 h-4" /> {t('hipico.apuestas.print')}
          </button>
        )}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">{t('hipico.apuestas.colTicket')}:</span>
            <span className="ml-2 font-mono font-bold">{apuesta.numero_ticket}</span>
          </div>
          <div>
            <span className="text-gray-500">{t('hipico.apuestas.colType')}:</span>
            <span className="ml-2">{t(`hipico.apuestas.tipo.${apuesta.tipo_apuesta}`, { defaultValue: apuesta.tipo_apuesta })}</span>
          </div>
          <div>
            <span className="text-gray-500">{t('hipico.colRace')}:</span>
            <span className="ml-2">{apuesta.hipodromo} #{apuesta.numero_carrera}</span>
          </div>
          <div>
            <span className="text-gray-500">{t('contable.colStatus')}:</span>
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
              apuesta.estado === 'ganada' ? 'bg-green-100 text-green-700' :
              apuesta.estado === 'perdida' ? 'bg-red-100 text-red-700' :
              apuesta.estado === 'anulada' ? 'bg-gray-100 text-gray-500' :
              'bg-blue-100 text-blue-700'
            }`}>
              {t(`hipico.apuestas.estado.${apuesta.estado}`, { defaultValue: apuesta.estado })}
            </span>
          </div>
          <div>
            <span className="text-gray-500">{t('hipico.apuestas.colAmount')}:</span>
            <span className="ml-2 font-semibold">{formatMoney(apuesta.monto)}</span>
          </div>
          <div>
            <span className="text-gray-500">{t('hipico.apuestas.odds')}:</span>
            <span className="ml-2 font-semibold">{apuesta.odd_total?.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500">{t('hipico.apuestas.colPayout')}:</span>
            <span className="ml-2 font-semibold">{formatMoney(apuesta.payout_potencial)}</span>
          </div>
          {apuesta.ganancia != null && (
            <div>
              <span className="text-gray-500">{t('hipico.apuestas.colWinnings')}:</span>
              <span className="ml-2 font-semibold text-green-600">{formatMoney(apuesta.ganancia)}</span>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">{t('hipico.apuestas.selections')}</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>{t('hipico.colHorse')}</Th>
                <Th right>{t('hipico.colStartNumber')}</Th>
                <Th right>{t('hipico.apuestas.colOdds')}</Th>
                <Th right>{t('hipico.apuestas.colPosition')}</Th>
                <Th right>{t('hipico.apuestas.colResult')}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {selections.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 font-medium">{s.caballo_nombre}</td>
                  <td className="px-3 py-2 text-right">{s.caballo_numero ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{s.odd_individual?.toFixed(2) ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{s.posicion_predicha ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {s.resultado_posicion != null ? (
                      <span className={s.ganador ? 'text-green-600 font-semibold' : 'text-red-600'}>
                        {s.resultado_posicion}º
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {apuesta.notas && (
          <p className="text-xs text-gray-500">{t('common.notes')}: {apuesta.notas}</p>
        )}
      </div>
    </Modal>
  )
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm'

function Modal({
  title,
  children,
  onClose,
  onSave,
  saving,
  disabled,
  saveLabel,
  wide,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
  onSave: () => void
  saving: boolean
  disabled?: boolean
  saveLabel?: string
  wide?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'} p-5 space-y-3 max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">{title}</h2>
        {children}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
            {t('common.cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={saving || disabled}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {saveLabel || t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Card({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${colors[color] || 'bg-gray-100'}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-xs font-semibold text-gray-500 uppercase ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}
