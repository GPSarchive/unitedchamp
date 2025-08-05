'use client';

import Image from 'next/image';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

export function Carousel({ images }: { images: string[] }) {
  return (
    <Swiper
      modules={[Autoplay, Pagination]}
      autoplay={{ delay: 4000, disableOnInteraction: false }}
      pagination={{ clickable: true }}
      loop
      className="w-full h-[900px] sm:h-[400px] md:h-[600px]"
    >
      {images.map((url, i) => (
        <SwiperSlide key={i}>
          <div className="relative w-full h-full">
            <Image src={url} alt={`Slide ${i + 1}`} fill className="object-cover" priority={i === 0} />
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
