"use client"

import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"
import { useEffect, useRef, useState } from "react"

export default function Home() {
    const [loaded, setLoaded] = useState(false)
    const [applying, setApplying] = useState(false)
    const [error, setError] = useState("")

    // ==============================
    // 8D SETTINGS
    // ==============================
    const [eightDAmount, setEightDAmount] = useState(0.82)
    const [eightDSpeed, setEightDSpeed] = useState(0.10)
    const [stereoWidth, setStereoWidth] = useState(1)
    const [irWet, setIrWet] = useState(0.30)
    const [volume, setVolume] = useState(20)

    const ffmpegRef = useRef(new FFmpeg())

    const inputRef = useRef(null)
    const outputRef = useRef(null)

    const inputUrlRef = useRef(null)
    const outputUrlRef = useRef(null)

    const loadingRef = useRef(false)

    useEffect(() => {
        loadFFmpeg()

        return () => {
            if (inputUrlRef.current) {
                URL.revokeObjectURL(inputUrlRef.current)
            }

            if (outputUrlRef.current) {
                URL.revokeObjectURL(outputUrlRef.current)
            }
        }
    }, [])

    // ==========================================================
    // LOAD FFMPEG
    // ==========================================================

    async function loadFFmpeg() {
        if (loadingRef.current || loaded) {
            return
        }

        loadingRef.current = true

        try {
            const baseURL =
                "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd"

            const ffmpeg = ffmpegRef.current

            ffmpeg.on("log", ({ message }) => {
                console.log("[FFMPEG]", message)
            })

            console.log("[FFMPEG] Mulai loading...")

            await ffmpeg.load({
                coreURL: await toBlobURL(
                    `${baseURL}/ffmpeg-core.js`,
                    "text/javascript"
                ),

                wasmURL: await toBlobURL(
                    `${baseURL}/ffmpeg-core.wasm`,
                    "application/wasm"
                ),
            })

            console.log("[FFMPEG] Berhasil loaded")

            setLoaded(true)
        } catch (err) {
            console.error("[FFMPEG LOAD ERROR]", err)

            setError(
                "FFmpeg gagal dimuat. Cek Console browser."
            )
        } finally {
            loadingRef.current = false
        }
    }

    // ==========================================================
    // SUBMIT
    // ==========================================================

    async function onSubmit(event) {
        event.preventDefault()

        const data = new FormData(event.target)

        const file = data.get("source")
        const customIrFile = data.get("customIr")

        if (!file || !(file instanceof File) || file.size === 0) {
            setError("Pilih audio MP3 terlebih dahulu.")
            return
        }

        // Ambil nilai setting terbaru dari form.
        const amount = Number(data.get("eightDAmount") ?? eightDAmount)
        const speed = Number(data.get("eightDSpeed") ?? eightDSpeed)
        const width = Number(data.get("stereoWidth") ?? stereoWidth)
        const wet = Number(data.get("irWet") ?? irWet)
        const volumeValue = Number(data.get("volume") ?? volume)

        await create8DAudio(
            file,
            customIrFile instanceof File && customIrFile.size > 0
                ? customIrFile
                : null,
            {
                amount,
                speed,
                width,
                wet,
                volume: volumeValue,
            }
        )
    }

    // ==========================================================
    // CREATE 8D
    // ==========================================================

    async function create8DAudio(file, customIrFile, settings) {
        const ffmpeg = ffmpegRef.current

        try {
            setApplying(true)
            setError("")

            console.log("====================================")
            console.log("[8D] Mulai proses")
            console.log("[8D] File:", file.name)
            console.log("[8D] Size:", file.size, "bytes")
            console.log(
                "[8D] IR:",
                customIrFile
                    ? `CUSTOM - ${customIrFile.name}`
                    : "DEFAULT - /ir.wav"
            )
            console.log("[8D] Settings:", settings)
            console.log("====================================")

            // ==================================================
            // VALIDASI SETTING
            // ==================================================

            const amount = Math.max(
                0,
                Math.min(1, Number(settings.amount))
            )

            const speed = Math.max(
                0.01,
                Math.min(1, Number(settings.speed))
            )

            const width = Math.max(
                0,
                Math.min(1, Number(settings.width))
            )

            const wet = Math.max(
                0,
                Math.min(1, Number(settings.wet))
            )

            const volumeValue = Math.max(
                1,
                Math.min(50, Number(settings.volume))
            )

            // ==================================================
            // HAPUS FILE LAMA
            // ==================================================

            console.log("[8D] Membersihkan virtual filesystem...")

            for (const filename of [
                "input.mp3",
                "ir.wav",
                "8d-output.mp3",
            ]) {
                try {
                    await ffmpeg.deleteFile(filename)
                } catch {}
            }

            // ==================================================
            // MASUKKAN AUDIO UTAMA
            // ==================================================

            console.log("[8D] Membaca audio utama...")

            const inputData = await fetchFile(file)

            if (!inputData || inputData.length === 0) {
                throw new Error("Audio utama kosong.")
            }

            console.log(
                "[8D] Input berhasil dibaca:",
                inputData.length,
                "bytes"
            )

            await ffmpeg.writeFile(
                "input.mp3",
                inputData
            )

            console.log(
                "[8D] input.mp3 berhasil masuk FFmpeg"
            )

            // ==================================================
            // MASUKKAN IR
            // ==================================================

            let irData
            let irSourceName

            if (customIrFile) {
                console.log(
                    "[8D] Menggunakan custom IR:",
                    customIrFile.name
                )

                irData = await fetchFile(customIrFile)
                irSourceName = customIrFile.name
            } else {
                console.log(
                    "[8D] Menggunakan IR bawaan: /ir.wav"
                )

                irData = await fetchFile("/ir.wav")
                irSourceName = "Default /ir.wav"
            }

            if (!irData || irData.length === 0) {
                throw new Error(
                    customIrFile
                        ? "File IR custom kosong."
                        : "ir.wav kosong atau tidak ditemukan. Pastikan public/ir.wav tersedia."
                )
            }

            console.log(
                "[8D] IR berhasil dibaca:",
                irSourceName,
                irData.length,
                "bytes"
            )

            await ffmpeg.writeFile(
                "ir.wav",
                irData
            )

            console.log(
                "[8D] ir.wav berhasil masuk FFmpeg"
            )

            // ==================================================
            // FILTER GRAPH
            // ==================================================
            //
            // amount:
            //   intensitas gerakan kiri-kanan
            //
            // speed:
            //   kecepatan putaran (Hz)
            //
            // width:
            //   lebar stereo
            //
            // wet:
            //   jumlah efek IR/depth
            //
            // volume:
            //   1x - 50x
            //
            // ==================================================

            const filterComplex =
                "[0:a]" +
                "aresample=48000," +
                "aformat=sample_fmts=fltp:channel_layouts=stereo," +
                "highpass=f=28," +
                "lowpass=f=18500" +
                "[main];" +

                "[1:a]" +
                "aresample=48000," +
                "aformat=sample_fmts=fltp:channel_layouts=stereo" +
                "[ir];" +

                "[main][ir]" +
                `afir=dry=1:wet=${wet},` +

                "stereowiden=" +
                "delay=12:" +
                "feedback=0.08:" +
                "crossfeed=0.06:" +
                `drymix=${1 - width},` +

                "apulsator=" +
                "mode=sine:" +
                `amount=${amount}:` +
                "offset_l=0:" +
                "offset_r=0.5:" +
                "width=1:" +
                "timing=hz:" +
                `hz=${speed},` +

                `volume=${volumeValue}` +



                "[out]"

            console.log(
                "[8D] Filter graph:",
                filterComplex
            )

            // ==================================================
            // RUN FFMPEG
            // ==================================================

            console.log("[8D] Menjalankan FFmpeg...")

            await ffmpeg.exec([
                "-i",
                "input.mp3",

                "-i",
                "ir.wav",

                "-filter_complex",
                filterComplex,

                "-map",
                "[out]",

                "-ar",
                "48000",

                "-ac",
                "2",

                "-c:a",
                "libmp3lame",

                "-b:a",
                "320k",

                "-id3v2_version",
                "3",

                "-y",

                "8d-output.mp3",
            ])

            console.log(
                "[8D] FFmpeg selesai memproses audio"
            )

            // ==================================================
            // AUDIO ASLI
            // ==================================================

            if (inputUrlRef.current) {
                URL.revokeObjectURL(
                    inputUrlRef.current
                )
            }

            inputUrlRef.current =
                URL.createObjectURL(file)

            if (inputRef.current) {
                inputRef.current.src =
                    inputUrlRef.current

                inputRef.current.load()
            }

            // ==================================================
            // BACA HASIL
            // ==================================================

            console.log(
                "[8D] Membaca 8d-output.mp3..."
            )

            const outputData =
                await ffmpeg.readFile(
                    "8d-output.mp3"
                )

            console.log(
                "[8D] Output berhasil dibaca:",
                outputData.length,
                "bytes"
            )

            if (
                !outputData ||
                outputData.length === 0
            ) {
                throw new Error(
                    "Output audio kosong."
                )
            }

            // ==================================================
            // BUAT BLOB
            // ==================================================

            const outputBlob =
                new Blob(
                    [outputData.buffer],
                    {
                        type: "audio/mpeg",
                    }
                )

            // ==================================================
            // AUDIO URL
            // ==================================================

            if (outputUrlRef.current) {
                URL.revokeObjectURL(
                    outputUrlRef.current
                )
            }

            outputUrlRef.current =
                URL.createObjectURL(
                    outputBlob
                )

            if (outputRef.current) {
                outputRef.current.src =
                    outputUrlRef.current

                outputRef.current.load()
            }

            console.log(
                "[8D] Audio 8D berhasil dibuat!"
            )

            console.log("====================================")
        } catch (err) {
            console.error(
                "[8D ERROR]",
                err
            )

            setError(
                err?.message ||
                "Gagal memproses audio."
            )
        } finally {
            setApplying(false)
        }
    }

    // ==========================================================
    // ERROR
    // ==========================================================

    if (error) {
        return (
            <main className="p-6">
                <div className="max-w-xl mx-auto">

                    <h1 className="text-xl font-semibold mb-3">
                        Terjadi Error
                    </h1>

                    <p className="text-red-500 mb-4">
                        {error}
                    </p>

                    <button
                        type="button"
                        onClick={() => setError("")}
                        className="
                            bg-slate-950
                            text-white
                            px-4
                            py-2
                            rounded-lg
                        "
                    >
                        Kembali
                    </button>

                </div>
            </main>
        )
    }

    // ==========================================================
    // LOADING
    // ==========================================================

    if (!loaded) {
        return (
            <main className="p-6">
                <div className="max-w-xl mx-auto">

                    <p>
                        Loading FFmpeg...
                    </p>

                </div>
            </main>
        )
    }

    // ==========================================================
    // UI
    // ==========================================================

    return (
        <main className="audio-app">
            <div className="ambient ambient-purple"></div>
            <div className="ambient ambient-blue"></div>

            {applying && (
                <div className="processing-overlay">
                    <div className="loader-card">
                        <div className="loader-orb">
                            <span></span>
                        </div>
                        <div className="loader-title">Membuat Audio 8D</div>
                        <div className="loader-text">
                            FFmpeg sedang memproses audio + IR depth...
                        </div>
                        <div className="loader-bar">
                            <div className="loader-bar-fill"></div>
                        </div>
                        <div className="loader-hint">Jangan tutup halaman ini</div>
                    </div>
                </div>
            )}

            <div className="app-shell">
                <header className="hero">
                    <div className="brand-badge">
                        <span className="brand-dot"></span>
                        AUDIO LAB
                    </div>

                    <h1>
                        Create <span>8D</span> Audio
                    </h1>

                    <p>
                        WES POKOKE SETTINGEN DEWE.
                    </p>
                </header>

                <form className="control-panel" onSubmit={onSubmit}>

                    <section className="glass-card">
                        <div className="section-heading">
                            <div className="section-icon">♫</div>
                            <div>
                                <h2>Audio Source</h2>
                                <p>Upload audio utama yang ingin diproses.</p>
                            </div>
                        </div>

                        <label className="upload-box">
                            <input
                                type="file"
                                name="source"
                                accept="audio/mpeg,.mp3"
                                required
                            />
                        </label>
                    </section>

                    <section className="glass-card">
                        <div className="section-heading">
                            <div>
                                <h2>IR / Depth</h2>
                                <p>
                                    (Opsional) Impulse response custom.
                                </p>
                            </div>
                        </div>

                        <label className="upload-box secondary">
                            <input
                                type="file"
                                name="customIr"
                                accept="audio/wav,.wav"
                            />
                        </label>
                    </section>

                    <section className="glass-card settings-card">
                        <div className="section-heading">
                            <div>
                                <h2>8D Controls</h2>
                                <p>Atur karakter gerakan, ruang, dan volume.</p>
                            </div>
                        </div>

                        <div className="settings-grid">

                            <div className="setting">
                                <div className="setting-top">
                                    <label>Intensitas 8D</label>
                                    <span>{Math.round(eightDAmount * 100)}%</span>
                                </div>
                                <input
                                    className="neon-range"
                                    type="range"
                                    name="eightDAmount"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={eightDAmount}
                                    onChange={(event) =>
                                        setEightDAmount(Number(event.target.value))
                                    }
                                />
                                <small>Seberapa kuat suara bergerak kiri-kanan.</small>
                            </div>

                            <div className="setting">
                                <div className="setting-top">
                                    <label>Kecepatan 8D</label>
                                    <span>{eightDSpeed.toFixed(2)} Hz</span>
                                </div>
                                <input
                                    className="neon-range blue-range"
                                    type="range"
                                    name="eightDSpeed"
                                    min="0.01"
                                    max="0.50"
                                    step="0.01"
                                    value={eightDSpeed}
                                    onChange={(event) =>
                                        setEightDSpeed(Number(event.target.value))
                                    }
                                />
                                <small>Nilai kecil menghasilkan gerakan lebih lambat.</small>
                            </div>

                            <div className="setting">
                                <div className="setting-top">
                                    <label>Stereo Width</label>
                                    <span>{Math.round(stereoWidth * 100)}%</span>
                                </div>
                                <input
                                    className="neon-range blue-range"
                                    type="range"
                                    name="stereoWidth"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={stereoWidth}
                                    onChange={(event) =>
                                        setStereoWidth(Number(event.target.value))
                                    }
                                />
                                <small>Mengatur seberapa lebar bidang stereo.</small>
                            </div>

                            <div className="setting">
                                <div className="setting-top">
                                    <label>IR / Depth</label>
                                    <span>{Math.round(irWet * 100)}%</span>
                                </div>
                                <input
                                    className="neon-range"
                                    type="range"
                                    name="irWet"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={irWet}
                                    onChange={(event) =>
                                        setIrWet(Number(event.target.value))
                                    }
                                />
                                <small>Semakin tinggi, semakin kuat karakter ruang.</small>
                            </div>

                            <div className="setting setting-volume">
                                <div className="setting-top">
                                    <label>Volume</label>
                                    <span>{volume}×</span>
                                </div>
                                <input
                                    className="neon-range blue-range"
                                    type="range"
                                    name="volume"
                                    min="1"
                                    max="50"
                                    step="1"
                                    value={volume}
                                    onChange={(event) =>
                                        setVolume(Number(event.target.value))
                                    }
                                />
                                <small>Volume dari 1× sampai 50×.</small>
                            </div>

                        </div>
                    </section>

                    <button
                        type="submit"
                        disabled={applying}
                        className="generate-button"
                    >
                        <span className="button-glow"></span>
                        <span className="button-content">
                            {applying ? "Processing..." : "Generate 8D Audio"}
                        </span>
                    </button>
                </form>

                <section className="results-grid">

                    <div className="audio-card">
                        <h3>Audio Asli</h3>
                        <audio ref={inputRef} controls />
                    </div>

                    <div className="audio-card result-active">
                        <h3>Hasil</h3>
                        <audio ref={outputRef} controls />
                    </div>

                </section>
            </div>
        </main>
    )
}
