import NoSSRWrapper from "./NoSSRWrapper"
import Home from "./Home"

export default function HomePage() {
  return (
    <NoSSRWrapper>
      <Home />
    </NoSSRWrapper>
  )
}