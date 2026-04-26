import Image from "next/image";

type Props = {
  variant?: "header" | "hero";
  priority?: boolean;
};

export function BrandLogo({ variant = "header", priority = false }: Props) {
  if (variant === "hero") {
    return (
      <div className="mx-auto w-full max-w-xl rounded-3xl bg-black p-6 shadow-[0_0_100px_rgba(0,0,0,0.55)] ring-1 ring-white/12 sm:p-10">
        <Image
          src="/blackstart-labs-logo.png"
          alt="Blackstart Labs — waveforms and network motif"
          width={720}
          height={400}
          className="h-auto w-full object-contain"
          priority={priority}
        />
      </div>
    );
  }

  return (
    <div className="flex h-10 shrink-0 items-center rounded-xl bg-black px-2 ring-1 ring-white/15 sm:h-11 sm:px-2.5">
      <Image
        src="/blackstart-labs-logo.png"
        alt=""
        width={220}
        height={88}
        className="h-7 w-auto max-w-[9rem] object-contain object-left sm:h-8 sm:max-w-[10.5rem]"
        priority={priority}
      />
    </div>
  );
}
