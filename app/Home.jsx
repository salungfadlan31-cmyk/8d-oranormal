"use client"

import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"
import { useEffect, useRef, useState } from "react"

export default function Home() {
    const [loaded, setLoaded] = useState(false)
    const [applying, setApplying] = useState(false)
    const ffmpegRef = useRef(new FFmpeg())
    const inputRef = useRef(null)
    const convolvedRef = useRef(null)
    const rotatedRef = useRef(null)
    const messageRef = useRef(null)

    useEffect(() => {
        load()
    }, [])

    async function load() {
        const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd"
        const ffmpeg = ffmpegRef.current

        ffmpeg.on("log", ({ message }) => {
            if (messageRef.current) {
                messageRef.current.innerHTML = message
            }
        })

        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
            wasmURL: await toBlobURL(
                `${baseURL}/ffmpeg-core.wasm`,
                "application/wasm"
            )
        })

        setLoaded(true)
    }

    async function onSubmit(event) {
        event.preventDefault()

        const data = new FormData(event.target)
        const source = data.get("source")
        applyEffect(source)
    }

    async function applyEffect(file) {
        const ffmpeg = ffmpegRef.current

        setApplying(true)

        await ffmpeg.writeFile("ir.wav", await fetchFile("/ir.wav"))
        await ffmpeg.writeFile(file.name, await fetchFile(file))

        await ffmpeg.exec([
            "-i",
            file.name,
            "-i",
            "ir.wav",
            "-filter_complex",
            "[0:a][1:a]afir,volume=20",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "320k",
            "convolved.mp3"
        ])

        await ffmpeg.exec([
            "-i",
            "convolved.mp3",
            "-af",
            "apulsator=hz=0.125",
            "rotated.mp3"
        ])

        if (inputRef.current) {
            inputRef.current.src = URL.createObjectURL(file)
        }

        const convolvedData = await ffmpeg.readFile("convolved.mp3")

        if (convolvedRef.current) {
            convolvedRef.current.src = URL.createObjectURL(
                new Blob([convolvedData.buffer], { type: "audio/mpeg" })
            )
        }

        const rotatedData = await ffmpeg.readFile("rotated.mp3")

        if (rotatedRef.current) {
            rotatedRef.current.src = URL.createObjectURL(
                new Blob([rotatedData.buffer], { type: "audio/mpeg" })
            )
        }

        setApplying(false)
    }

    return loaded ? (
        <div className="p-4 flex flex-col gap-4">
            <form className="flex flex-col gap-4" onSubmit={onSubmit}>
                <div>
                    <input type="file" name="source" accept="audio/mpeg" required />
                </div>
                <div>
                    <button disabled={applying} className="bg-slate-950 text-slate-50 px-4 py-2 rounded-lg disabled:opacity-80">Terapkan efek</button>
                </div>
            </form>
            <p>{applying ? "Menerapkan efek..." : ""}</p>
            <audio ref={inputRef} controls></audio>
            <audio ref={convolvedRef} controls></audio>
            <audio ref={rotatedRef} controls></audio>
        </div>
    ) : (
        <p>Loading ffmpeg...</p>
    )
}