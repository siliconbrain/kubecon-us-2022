const utf8Decoder = new TextDecoder()
const pipeline = []

async function loadStageFromFile(file) {
  const stage = {
    id: Date.now().toString(16),
    origin: file,
    data: null,
    errors : null,
    sent: null,
  }

  try {
    stage.module = await WebAssembly.compile(await file.arrayBuffer())
    const exportDescs = WebAssembly.Module.exports(stage.module)

    if (exportDescs.findIndex((desc) => desc.kind === 'function' && desc.name === 'receive') < 0)
      throw new Error("plugin does not export 'receive' function")

    const importDescs = WebAssembly.Module.imports(stage.module)

    const imports = {}
    for (const importDesc of importDescs) {
      function setImport(value) {
        imports[importDesc.module] = imports[importDesc.module] || {}
        imports[importDesc.module][importDesc.name] = value
      }

      if (importDesc.kind === 'memory') {
        stage.memory = new WebAssembly.Memory({ initial: 1 })
        setImport(stage.memory)
        continue
      }
      if (importDesc.kind === 'function' && importDesc.name === 'error') {
        function error(ptr, len) {
          const msgBuf = new Uint8Array(stage.memory.buffer, ptr, len)
          const errorMsg = utf8Decoder.decode(msgBuf)
          if (stage.errors === null) {
            stage.errors = []
          }
          stage.errors.push(errorMsg)
        }
        setImport(error)
        continue
      }
      if (importDesc.kind === 'function' && importDesc.name === 'get_data') {
        function getData(ptr) {
          const block = new Uint8Array(stage.memory.buffer, ptr)

          const data = stage.data
          stage.data = null

          if (!data) throw new Error('stage tried to get data when there was no data set')

          block.set(data)
        }
        setImport(getData)
        continue
      }
      if (importDesc.kind === 'function' && importDesc.name === 'send') {
        function send(ptr, len) {
          const block = new Uint8Array(stage.memory.buffer, ptr, len)

          const copy = new Uint8Array(block.length)
          copy.set(block)
          if (stage.sent === null) {
            stage.sent = []
          }
          stage.sent.push(copy)
        }
        setImport(send)
        continue
      }
      if (importDesc.kind === 'function') {
        setImport(function () {
          console.error('not implemented', importDesc)
        })
        console.info('stubbed import', importDesc, stage)
        continue
      }
      console.error('unsupported import', importDesc, stage.module)
      return
    }

    stage.instance = await WebAssembly.instantiate(stage.module, imports)

    if (stage.memory === undefined) {
      stage.memory = stage.instance.exports.memory
    }

    pipeline.push(stage)

    onPipelineChanged()
  } catch (err) {
    onError(err)
  }
}

function processRecord(record) {
  const result = {
    input: record,
    byStage: [],
    outputs: [],
  }

  if (!record) {
    onRecordProcessed(result)
    return
  }

  result.outputs = [record]
  for (const stage of pipeline) {
    const inputs = result.outputs
    result.outputs = []
    const stageResult = {
      stageId: stage.id,
      results: [],
    }
    for (const input of inputs) {
      console.assert(stage.data === null, 'stage data should be cleared', { data: stage.data, stage })
      stage.data = input
      console.assert(stage.errors === null, 'stage errors should be cleared', {errors: stage.errors, stage})
      stage.errors = []
      console.assert(stage.sent === null, 'stage sent should be cleared', { sent: stage.sent, stage })
      stage.sent = []
      stage.instance.exports.receive(stage.data.length)
      if (stage.data !== null) {
        console.debug('stage did not consume data (no call to get_data)', { data: stage.data, stage })
        stage.data = null
      }
      stageResult.results.push({
        input,
        errors: stage.errors,
        outputs: stage.sent,
      })
      result.outputs.push(...stage.sent)
      stage.errors = null // clear errors
      stage.sent = null // clear sent
    }
    result.byStage.push(stageResult)
  }
  onRecordProcessed(result)
}

function removeStage(id) {
  pipeline.splice(
    pipeline.findIndex((stage) => stage.id === id),
    1,
  )
  onPipelineChanged()
}

function onPipelineChanged() {
  postMessage({ name: 'onPipelineChanged', args: [pipeline.map((stage) => ({ id: stage.id, origin: stage.origin }))] })
}

function onRecordProcessed(result) {
  postMessage({ name: 'onRecordProcessed', args: [result] })
}

function onError(err) {
  postMessage({ name: 'onError', args: [err] })
}

onmessage = function (msg) {
  const { name, args } = msg.data
  if (name === 'loadStageFromFile') {
    return loadStageFromFile(...args)
  }

  if (name === 'removeStage') {
    return removeStage(...args)
  }

  if (name === 'processRecord') {
    return processRecord(...args)
  }
}

onPipelineChanged()
onRecordProcessed()
