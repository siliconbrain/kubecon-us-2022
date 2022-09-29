import { useCallback, useEffect, useRef, useState } from 'react'
import { Switch } from '@headlessui/react'

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

function Toggle({ defaultValue = false, onChange }) {
  const [enabled, setEnabled] = useState(defaultValue)

  useEffect(() => {
    onChange?.(enabled)
  }, [enabled, onChange])

  return (
    <Switch
      checked={enabled}
      onChange={setEnabled}
      className={classNames(
        enabled ? 'bg-indigo-600' : 'bg-gray-200',
        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
      )}
    >
      <span className="sr-only">Use setting</span>
      <span
        aria-hidden="true"
        className={classNames(
          enabled ? 'translate-x-5' : 'translate-x-0',
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
        )}
      />
    </Switch>
  )
}

export default function Home() {
  const [pipeline, setPipeline] = useState([])
  const [autorun, setAutorun] = useState(false)
  const [error, setError] = useState(null)
  const [record, setRecord] = useState('')
  const workerRef = useRef()
  const textareaRef = useRef()

  const onPipelineChanged = useCallback((p) => {
    setPipeline(p)
  }, [])
  const [results, setResults] = useState({})
  const onRecordProcessed = useCallback((r) => {
    setResults(r)
  }, [])
  const onWorkerError = useCallback((e) => {
    setError(e)
  }, [])

  useEffect(() => {
    workerRef.current = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
    workerRef.current.onmessage = function (msg) {
      const { name, args } = msg.data
      if (name === 'onPipelineChanged') {
        return onPipelineChanged(...args)
      }

      if (name === 'onRecordProcessed') {
        return onRecordProcessed(...args)
      }

      if (name === 'onWorkerError') {
        return onWorkerError(...args)
      }

      console.warn(`No such function ${name}`)
    }

    pipeline?.forEach(({ origin: file }) => workerRef.current?.postMessage({ name: 'loadStageFromFile', args: [file] }))

    return () => {
      workerRef.current.terminate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onFileInput = useCallback(
    async (e) => {
      setError(null)

      const file = e.target.files[0]
      e.target.value = null
      try {
        workerRef.current?.postMessage({ name: 'loadStageFromFile', args: [file] })
      } catch (err) {
        setError(err)
      }
    },
    [setError, workerRef],
  )

  const onRemoveStage = useCallback(
    (id) => {
      workerRef.current?.postMessage({ name: 'removeStage', args: [id] })
    },
    [workerRef],
  )

  const onRun = useCallback(() => {
    let r = ''
    if (record) {
      r = new TextEncoder().encode(record)
    }

    workerRef.current?.postMessage({ name: 'processRecord', args: [r] })
  }, [workerRef, record])

  useEffect(() => {
    if (autorun) {
      onRun()
    }
  }, [autorun, record, pipeline, onRun])

  useEffect(() => {
    console.log(pipeline)
  }, [pipeline])

  useEffect(() => {
    console.log(results)
  }, [results])

  return (
    <div className="flex flex-col h-full w-full">
      {error ? (
        <div className="bg-red-100 text-red-700 px-4 py-2 flex justify-between items-center">
          <div>{error.message}</div>
          <button className="text-xl text-black" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      ) : null}
      <div className="flex p-4 flex-1">
        <div className="mr-4 border-r-2 border-slate-200 border-solid pr-8 p-4">
          <div>
            <label className="flex items-center justify-center text-blue-800 w-48 h-12 rounded-md cursor-pointer hover:bg-blue-100 ring-2 ring-blue-300 hover:ring-blue-400">
              <span className="font-bold text-xl">load</span>
              <input type="file" onChange={onFileInput} accept="application/wasm" className="hidden" />
            </label>
          </div>
          <div className="mt-4 divide-y divide-slate-200">
            {pipeline?.map(({ id, origin }) => (
              <div key={id} className="py-2 flex justify-between items-center">
                <div>{origin.name}</div>
                <button className="text-xl text-black" onClick={() => onRemoveStage(id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 pl-2 ml-2 flex-col">
          <div className="flex gap-x-4">
            <textarea
              className="block w-full font-mono resize-none border-0 py-3 focus:ring-1 rounded-md focus:ring-blue-400 ring-slate-200"
              placeholder="Add your log..."
              defaultValue={''}
              onChange={(e) => setRecord(e.target.value)}
            />
            <div className="flex flex-col gap-y-2">
              <button className="bottom-0 right-0 bg-blue-800 text-white px-4 py-2 rounded-md" onClick={onRun}>
                run
              </button>
              <div className="flex items-center gap-x-2">
                <Toggle defaultValue={autorun} onChange={setAutorun} />
                <span>autorun</span>
              </div>
            </div>
          </div>
          <div className="my-4 px-2 divide-y divide-slate-200">
            {results?.outputs?.map((o, idx) => (
              <pre className="block py-2" key={idx}>
                {new TextDecoder().decode(o)}
              </pre>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
