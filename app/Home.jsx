"use client"

import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"
import { useEffect, useRef, useState } from "react"

export default function Home() {
    const [loaded, setLoaded] = useState(false)
    const [applying, setApplying] = useState(false)
    const [error, setError] = useState("")

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

            // Log dari FFmpeg
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

        if (!file) {
            return
        }

        await create8DAudio(file)
    }

    // ==========================================================
    // CREATE 8D
    // ==========================================================

    async function create8DAudio(file) {
        const ffmpeg = ffmpegRef.current

        try {
            setApplying(true)
            setError("")

            console.log("====================================")
            console.log("[8D] Mulai proses")
            console.log("[8D] File:", file.name)
            console.log("[8D] Size:", file.size, "bytes")
            console.log("====================================")

            // ==================================================
            // HAPUS FILE LAMA
            // ==================================================

            console.log("[8D] Membersihkan virtual filesystem...")

            try {
                await ffmpeg.deleteFile("input.mp3")
            } catch {}

            try {
                await ffmpeg.deleteFile("ir.wav")
            } catch {}

            try {
                await ffmpeg.deleteFile("8d-output.mp3")
            } catch {}

            // ==================================================
            // MASUKKAN AUDIO UTAMA
            // ==================================================

            console.log("[8D] Membaca audio utama...")

            const inputData = await fetchFile(file)

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

            console.log("[8D] Mengambil ir.wav...")

            const irData = await fetchFile("/ir.wav")

            console.log(irData)

            console.log(
                "[8D] IR berhasil diambil:",
                irData.length,
                "bytes"
            )

            if (!irData || irData.length === 0) {
                throw new Error(
                    "ir.wav kosong atau tidak ditemukan."
                )
            }

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
            // INPUT
            //   │
            //   ├─────────────── DRY
            //   │
            //   └── IR ──→ DEPTH
            //                    │
            //                    ↓
            //                 GABUNG
            //                    │
            //                    ↓
            //                8D MOTION
            //                    │
            //                    ↓
            //                LIMITER
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
                "afir=dry=1:wet=0.30," +

                "stereowiden=" +
                "delay=12:" +
                "feedback=0.08:" +
                "crossfeed=0.06:" +
                "drymix=0.94," +

                "apulsator=" +
                "mode=sine:" +
                "amount=0.82:" +
                "offset_l=0:" +
                "offset_r=0.5:" +
                "width=1:" +
                "timing=hz:" +
                "hz=0.10," +

                "volume=50," +

                "alimiter=" +
                "limit=0.95:" +
                "attack=5:" +
                "release=80:" +
                "level=0" +

                "[out]";

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

                    <p className="text-red-500">
                        {error}
                    </p>

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
        <main className="p-6">
            <div className="max-w-xl mx-auto">

                <form
                    className="flex flex-col gap-4"
                    onSubmit={onSubmit}
                >

                    <div>

                        <input
                            type="file"
                            name="source"
                            accept="audio/mpeg,.mp3"
                            required
                        />

                    </div>

                    <button
                        type="submit"
                        disabled={applying}
                        className="
                            bg-slate-950
                            text-white
                            px-4
                            py-2
                            rounded-lg
                            disabled:opacity-50
                        "
                    >
                        {applying
                            ? "Membuat audio 8D..."
                            : "Buat Audio 8D"}
                    </button>

                </form>

                {applying && (
                    <p className="mt-4">
                        Sedang membuat efek 8D + IR depth...
                    </p>
                )}

                <div className="mt-6 flex flex-col gap-6">

                    {/* AUDIO ASLI */}

                    <div>

                        <p className="mb-2 font-medium">
                            Audio asli
                        </p>

                        <audio
                            ref={inputRef}
                            controls
                            className="w-full"
                        />

                    </div>

                    {/* AUDIO HASIL */}

                    <div>

                        <p className="mb-2 font-medium">
                            Hasil 8D + IR Depth
                        </p>

                        <audio
                            ref={outputRef}
                            controls
                            className="w-full"
                        />

                    </div>

                </div>

            </div>
        </main>
    )
}