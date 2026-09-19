// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import RrhhPage from './RrhhPage'

const { apiMock, toasts } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  toasts: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

vi.mock('../lib/api-client', () => ({
  callApi: (channel: string, data?: unknown) => apiMock(channel, data),
}))

vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({ has: () => true, hasAny: () => true, hasAll: () => true, permissions: [], loading: false, reload: vi.fn() }),
}))

vi.mock('../components/ui/Toast', () => ({ useToast: () => toasts }))

vi.mock('../services/currency', () => ({
  formatMoney: (n: number | null | undefined) => `$${Number(n || 0).toFixed(2)}`,
}))

const EMPLEADOS = [
  { id: 1, nombre: 'Ana Pérez', documento: null, cargo: 'Cajera', salario_mensual: 300, telefono: null, direccion: null, fecha_ingreso: '2026-01-15', activo: 1 },
]
const CONCEPTOS = [{ id: 1, nombre: 'Bono Alimentación', tipo: 'asignacion', monto_default: 50, activo: 1 }]
const GRUPOS = [{
  id: 1, nombre: 'Fijos', descripcion: null, activo: 1, miembros: 1, conceptos: 1,
  empleado_ids: [1],
  conceptos_detalle: [{ concepto_id: 1, monto: 50, nombre: 'Bono Alimentación', tipo: 'asignacion', monto_default: 50 }],
}]

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.mockImplementation((channel: string) => {
    if (channel === 'rrhh:empleados-list') return Promise.resolve(EMPLEADOS)
    if (channel === 'rrhh:grupos-list') return Promise.resolve(GRUPOS)
    if (channel === 'rrhh:conceptos-list') return Promise.resolve(CONCEPTOS)
    if (channel === 'rrhh:nomina-list') return Promise.resolve([])
    if (channel === 'rrhh:asistencia-list') return Promise.resolve({ fecha: '2026-09-19', registros: [] })
    if (channel === 'rrhh:asistencia-historial') return Promise.resolve([])
    if (channel === 'rrhh:grupo-save' || channel === 'rrhh:concepto-save') return Promise.resolve({ success: true, id: 9 })
    if (channel === 'rrhh:nomina-generar') return Promise.resolve({ success: true, nominas: [] })
    return Promise.resolve(null)
  })
})

const irA = (labelKey: string) => fireEvent.click(screen.getByText(labelKey))

/** Reemplaza `window.open` por una ventana falsa y devuelve el HTML escrito. */
function mockVentanaImpresion() {
  const html: string[] = []
  const win = {
    document: { write: (h: string) => html.push(h), close: vi.fn() },
    focus: vi.fn(),
    print: vi.fn(),
  }
  vi.spyOn(window, 'open').mockReturnValue(win as any)
  return { html, win }
}

describe('RrhhPage — pestañas de grupos y conceptos', () => {
  it('muestra las pestañas Grupos y Conceptos', () => {
    render(<RrhhPage />)
    expect(screen.getByText('rrhh.tabGroups')).toBeInTheDocument()
    expect(screen.getByText('rrhh.tabConcepts')).toBeInTheDocument()
  })

  it('carga y lista los grupos', async () => {
    render(<RrhhPage />)
    irA('rrhh.tabGroups')
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('rrhh:grupos-list', {}))
    expect(await screen.findByText('Fijos')).toBeInTheDocument()
    // Sin grupo seleccionado, se muestra la ayuda.
    expect(screen.getByText('rrhh.selectGroupHint')).toBeInTheDocument()
  })

  it('al seleccionar un grupo muestra sus miembros y conceptos', async () => {
    render(<RrhhPage />)
    irA('rrhh.tabGroups')
    fireEvent.click(await screen.findByText('Fijos'))
    // 'rrhh.groupMembers' aparece como columna de la tabla y como título del panel.
    await waitFor(() => expect(screen.getAllByText('rrhh.groupMembers').length).toBeGreaterThan(0))
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('rrhh.groupConcepts')).toBeInTheDocument()
  })

  it('carga y lista el catálogo de conceptos', async () => {
    render(<RrhhPage />)
    irA('rrhh.tabConcepts')
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('rrhh:conceptos-list', { incluirInactivos: true }))
    expect(await screen.findByText('Bono Alimentación')).toBeInTheDocument()
  })

  it('crea un concepto del catálogo con el monto parseado', async () => {
    render(<RrhhPage />)
    irA('rrhh.tabConcepts')
    await screen.findByText('Bono Alimentación')

    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Prima' } })
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '25' } })
    fireEvent.click(screen.getByText('common.add'))

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('rrhh:concepto-save', {
        id: undefined,
        nombre: 'Prima',
        tipo: 'asignacion',
        monto_default: 25,
      }),
    )
  })

  it('crea un grupo al escribir un nombre y guardar', async () => {
    render(<RrhhPage />)
    irA('rrhh.tabGroups')
    await screen.findByText('Fijos')

    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Obreros' } })
    fireEvent.click(screen.getByText('rrhh.newGroup'))

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('rrhh:grupo-save', { id: undefined, nombre: 'Obreros', descripcion: undefined }),
    )
  })

  it('genera nómina enviando el grupo seleccionado', async () => {
    render(<RrhhPage />)
    irA('rrhh.tabPayroll')
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('rrhh:grupos-list', {}))

    const grupoSelect = screen
      .getAllByRole('combobox')
      .find((s) => Array.from((s as HTMLSelectElement).options).some((o) => o.text === 'Fijos'))
    expect(grupoSelect).toBeTruthy()
    fireEvent.change(grupoSelect as HTMLSelectElement, { target: { value: '1' } })

    fireEvent.click(screen.getByText('rrhh.generatePayroll'))
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('rrhh:nomina-generar', expect.objectContaining({ grupo_id: 1, bonos: {}, deducciones: {} })),
    )
  })
})

const HIST_ASISTENCIA = [
  { id: 1, empleado_id: 1, empleado_nombre: 'Ana Pérez', empleado_cargo: 'Cajera', fecha: '2026-09-19', estado: 'presente', notas: '' },
]

const NOMINA = {
  id: 5, empleado_id: 1, empleado_nombre: 'Ana Pérez', empleado_documento: 'V-1', empleado_cargo: 'Cajera',
  periodo_inicio: '2026-09-01', periodo_fin: '2026-09-15', salario_base: 300, dias_trabajados: 15,
  bonos: 50, deducciones: 10, total_pagar: 340,
  conceptos: [{ nombre: 'Bono Alimentación', monto: 50, tipo: 'asignacion' }],
}

describe('RrhhPage — vista previa de nómina', () => {
  beforeEach(() => {
    apiMock.mockImplementation((channel: string) => {
      if (channel === 'rrhh:empleados-list') return Promise.resolve(EMPLEADOS)
      if (channel === 'rrhh:grupos-list') return Promise.resolve(GRUPOS)
      if (channel === 'rrhh:nomina-list') return Promise.resolve([])
      if (channel === 'rrhh:asistencia-list') return Promise.resolve({ fecha: '2026-09-19', registros: [] })
      if (channel === 'rrhh:nomina-preview') {
        return Promise.resolve({
          success: true,
          filas: [{
            empleado_id: 1, empleado_nombre: 'Ana Pérez', empleado_documento: null, empleado_cargo: 'Cajera',
            salario_base: 300, dias_trabajados: 30, bonos: 50, deducciones: 10, total_pagar: 340,
            conceptos: [{ nombre: 'Bono Alimentación', tipo: 'asignacion', monto: 50, orden: 1 }],
          }],
          totales: { bruto: 350, deducciones: 10, neto: 340 },
        })
      }
      if (channel === 'rrhh:nomina-generar') return Promise.resolve({ success: true, nominas: [] })
      return Promise.resolve(null)
    })
  })

  it('previsualiza los montos y solo genera al confirmar', async () => {
    render(<RrhhPage />)
    irA('rrhh.tabPayroll')
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('rrhh:grupos-list', {}))

    fireEvent.click(screen.getByText('rrhh.preview'))

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('rrhh:nomina-preview', expect.objectContaining({ grupo_id: undefined })),
    )
    expect(await screen.findByText('rrhh.previewTitle')).toBeInTheDocument()
    expect(screen.getByText('+ Bono Alimentación: $50.00')).toBeInTheDocument()
    expect(screen.getAllByText('$340.00').length).toBeGreaterThan(0)

    // Todavía no se generó nada: la vista previa es un dry-run.
    expect(apiMock).not.toHaveBeenCalledWith('rrhh:nomina-generar', expect.anything())

    fireEvent.click(screen.getByText('rrhh.confirmGenerate'))
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('rrhh:nomina-generar', expect.objectContaining({ periodo_inicio: expect.any(String) })),
    )
    // Al confirmar, el modal se cierra.
    await waitFor(() => expect(screen.queryByText('rrhh.previewTitle')).not.toBeInTheDocument())
  })
})

describe('RrhhPage — impresión', () => {
  beforeEach(() => {
    apiMock.mockImplementation((channel: string) => {
      if (channel === 'rrhh:empleados-list') return Promise.resolve(EMPLEADOS)
      if (channel === 'rrhh:grupos-list') return Promise.resolve(GRUPOS)
      if (channel === 'rrhh:conceptos-list') return Promise.resolve(CONCEPTOS)
      if (channel === 'rrhh:nomina-list') return Promise.resolve([NOMINA])
      if (channel === 'rrhh:asistencia-list') return Promise.resolve({ fecha: '2026-09-19', registros: [] })
      if (channel === 'rrhh:asistencia-historial') return Promise.resolve(HIST_ASISTENCIA)
      if (channel === 'print:config') {
        return Promise.resolve({ razon_social: 'Bodega OmniMargen', rif: 'J-40123456-7', direccion: 'Av. Principal 123', telefono: '555-1234' })
      }
      return Promise.resolve(null)
    })
  })

  it('imprime el histórico de asistencias en A4 con los datos de la empresa', async () => {
    const { html, win } = mockVentanaImpresion()
    render(<RrhhPage />)

    irA('rrhh.tabAttendance')
    fireEvent.click(await screen.findByText('rrhh.applyFilter'))
    // El nombre aparece también en el filtro de empleado (select)
    await waitFor(() => expect(screen.getAllByText('Ana Pérez').length).toBeGreaterThan(1))

    fireEvent.click(screen.getAllByTitle('common.print')[0])

    await waitFor(() => expect(html).toHaveLength(1))
    expect(html[0]).toContain('Bodega OmniMargen')
    expect(html[0]).toContain('Ana Pérez')
    expect(html[0]).toContain('rrhh.attendanceHistory')
    expect(win.print).toHaveBeenCalled()
  })

  it('avisa (y no imprime) si no hay asistencias en el histórico', async () => {
    apiMock.mockImplementation((channel: string) => {
      if (channel === 'rrhh:empleados-list') return Promise.resolve(EMPLEADOS)
      if (channel === 'rrhh:asistencia-historial') return Promise.resolve([])
      if (channel === 'rrhh:asistencia-list') return Promise.resolve({ fecha: '2026-09-19', registros: [] })
      return Promise.resolve(null)
    })
    mockVentanaImpresion()
    render(<RrhhPage />)

    irA('rrhh.tabAttendance')
    fireEvent.click(await screen.findByText('rrhh.applyFilter'))
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('rrhh:asistencia-historial', expect.anything()))

    fireEvent.click(screen.getAllByTitle('common.print')[0])

    await waitFor(() => expect(toasts.info).toHaveBeenCalledWith('rrhh.noRecords'))
    expect(window.open).not.toHaveBeenCalled()
  })

  it('imprime el recibo individual de un trabajador', async () => {
    const { html } = mockVentanaImpresion()
    render(<RrhhPage />)

    irA('rrhh.tabPayroll')
    await waitFor(() => expect(screen.getAllByText('Ana Pérez').length).toBeGreaterThan(0))

    // El último botón de impresión de la tabla es el del recibo de esa fila.
    const botones = screen.getAllByTitle('common.print')
    fireEvent.click(botones[botones.length - 1])

    await waitFor(() => expect(html).toHaveLength(1))
    expect(html[0]).toContain('rrhh.payrollReceipt')
    expect(html[0]).toContain('Ana Pérez')
    expect(html[0]).toContain('Bono Alimentación')
    expect(html[0]).toContain('J-40123456-7')
  })
})
