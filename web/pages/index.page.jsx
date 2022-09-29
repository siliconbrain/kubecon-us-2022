import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
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
      <span className="sr-only">Auto-run</span>
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
  const [selected, setSelected] = useState(null)
  const [results, setResults] = useState({})
  const selectedResult = useMemo(
    () => results?.byStage?.find(({ stageId }) => stageId === selected),
    [selected, results],
  )
  const [autorun, setAutorun] = useState(true)
  const [error, setError] = useState(null)
  const [record, setRecord] = useState('')
  const workerRef = useRef()

  const onPipelineChanged = useCallback((p) => {
    setPipeline(p)
  }, [])
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

    workerRef.current?.postMessage({ name: 'loadStagesFromFiles', args: [pipeline?.map(({ origin }) => origin)] })

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

  const onRecordInputChange = useCallback((e) => {
    const r = e.target.value
    setRecord(r)
    if (r != null) {
      localStorage.setItem('record-input', r)
    }
  }, [])

  useEffect(() => {
    const r = localStorage.getItem('record-input')
    setRecord(r)
  }, [])

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
    <div className="flex flex-col h-full w-full overflow-hidden">
      {error ? (
        <div className="bg-red-100 text-red-700 px-4 py-2 flex justify-between items-center">
          <div>{error.message}</div>
          <button className="text-xl text-black" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      ) : null}
      <div className="flex flex-1 h-full w-full">
        <div className="mr-4 border-r-2 border-slate-200 border-solid flex flex-col items-center">
          <div className="flex-1 pt-4">
            <h2 className="w-full text-center mb-4 text-2xl font-bold">Plugins</h2>
            <div className="text-xl pl-4 font-medium gap-y-2 flex flex-col">
              {pipeline?.map(({ id, origin }) => (
                <div
                  key={id}
                  className={classNames(
                    'rounded-l-md py-4 pl-4 pr-8 flex justify-between items-center hover:bg-blue-200 cursor-pointer',
                    selected === id ? 'bg-blue-100' : '',
                  )}
                  onClick={() => (selected === id ? setSelected(null) : setSelected(id))}
                >
                  <div
                    className={
                      results?.byStage
                        ?.find(({ stageId }) => stageId === id)
                        ?.results?.some(({ errors }) => errors?.length > 0)
                        ? 'text-red-600'
                        : ''
                    }
                  >
                    {origin.name}
                  </div>
                  <button className="text-lg text-black ml-4 hover:text-red-800" onClick={() => onRemoveStage(id)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4">
            <label className="flex items-center justify-center text-blue-800 w-48 h-12 rounded-md cursor-pointer hover:bg-blue-100 ring-2 ring-blue-300 hover:ring-blue-400">
              <span className="font-bold text-xl">load</span>
              <input type="file" onChange={onFileInput} accept="application/wasm" className="hidden" />
            </label>
          </div>
        </div>
        <div className="flex-1 pl-2 pr-8 ml-2 flex-col flex pt-8 overflow-hidden">
          <div className="flex gap-x-4 relative">
            <textarea
              className="block bg-gray-50 pr-32 w-full font-mono resize-none border-0 py-3 focus:ring-1 rounded-md focus:ring-blue-400 ring-slate-200"
              placeholder="Add your log..."
              rows={8}
              onChange={onRecordInputChange}
              value={record}
            />
            <div className="absolute right-0 top-0 pt-4 pr-4 flex items-center gap-x-2 ">
              <span>autorun</span>
              <Toggle defaultValue={autorun} onChange={setAutorun} />
            </div>
            <div className="absolute right-0 bottom-0 pb-4 pr-4">
              <button
                disabled={autorun}
                className="bottom-0 right-0 bg-blue-800 text-white px-4 py-2 rounded-md disabled:hidden"
                onClick={onRun}
              >
                run
              </button>
            </div>
          </div>
          {selected ? null : (
            <div className="text-red-600">
              {results?.byStage?.map(({ stageId, results }) => (
                <div key={stageId}>
                  {results?.map(({ errors, input }) => (
                    <>
                      {errors?.length > 0 ? (
                        <div className="pl-2 pt-2">
                          <span className="font-bold mr-2">
                            {pipeline?.find(({ id }) => stageId === id)?.origin?.name}
                          </span>
                          {/* <span>
                            <span>(input: </span>
                            <code
                              className="inline-block align-bottom font-mono max-w-md overflow-hidden text-ellipsis"
                              title={new TextDecoder().decode(input)}
                            >
                              {new TextDecoder().decode(input)}
                            </code>
                            <span>):</span> */}
                          {/* </span> */}
                        </div>
                      ) : null}
                      {errors?.map((e, idx) => (
                        <div className="pl-4" key={idx}>
                          {e}
                        </div>
                      ))}
                    </>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className="my-4 px-2 divide-y divide-slate-200 overflow-y-auto">
            {selectedResult ? (
              <>
                {selectedResult?.results?.map(({ input, outputs, errors }, idx) => (
                  <div key={idx} className="py-2">
                    <div>
                      <span className="mr-2">⇥</span>
                      <span className="font-bold text-blue-600 mr-2">input {idx}.</span>
                      <div className="font-mono inline-block break-all">{new TextDecoder().decode(input)}</div>
                    </div>
                    {errors?.map((e) => (
                      <div className="pl-4 py-1 text-red-600" key={e}>
                        Error: {e}
                      </div>
                    ))}
                    <div>
                      {outputs?.map((o, idx) => (
                        <div key={idx} className="py-1 pl-4">
                          <span className="mr-2">⇤</span>
                          <span className="font-bold text-blue-600">{idx}.</span>
                          <div className="font-mono inline-block break-all" key={idx}>
                            {new TextDecoder().decode(o)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              results?.outputs?.map((o, idx) => (
                <div key={idx} className="py-1 pl-4">
                  <span className="mr-2">⇤</span>
                  <span className="font-bold text-blue-600 mr-2">{idx}.</span>
                  <div className="font-mono inline-block break-all" key={idx}>
                    {new TextDecoder().decode(o)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
