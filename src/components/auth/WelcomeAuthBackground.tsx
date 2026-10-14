
type Props = {
  backgroundImage: string;
  backgroundColor: string;
};

export default function WelcomeAuthBackground({
  backgroundImage,
  backgroundColor,
}: Props) {
  const isVideo = /\.(mp4|webm|mov)(?:[?#].*)?$/i.test(
    backgroundImage,
  );

  const safeImageUrl = backgroundImage.replace(/["\\]/g, "");

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ backgroundColor }}
    >
      {backgroundImage &&
        (isVideo ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
          >
            <source src={backgroundImage} />
          </video>
        ) : (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url("${safeImageUrl}")`,
            }}
          />
        ))}

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(5,7,13,0.18), rgba(5,7,13,0.48))",
        }}
      />
    </div>
  );
}