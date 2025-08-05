'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function Navbar() {
  return (
    <nav className="w-full h-36  flex items-center justify-between px-4 bg-gray-100 shadow-md">
      <div className="flex gap-4 items-center">
        {/* Placeholder 1 */}
        <Link href="/home" passHref>
        <div className="w-100 h-30 bg-gray-300 rounded hover:bg-gray-400 cursor-pointer flex items-center justify-center">
        <Image 
              src="/images/home-icon.png" 
              alt="Home" 
              width={24} 
              height={24} 
              className="object-contain"
            />
          </div>
        </Link>

        {/* Placeholder 2 */}
        <Link href="/profile" passHref>
        <div className="w-100 h-30 bg-gray-300 rounded hover:bg-gray-400 cursor-pointer flex items-center justify-center">
        <Image 
              src="/images/profile-icon.png" 
              alt="Profile" 
              width={24} 
              height={24} 
              className="object-contain"
            />
          </div>
        </Link>

        {/* Placeholder 3 */}
        <Link href="/settings" passHref>
          <div className="w-100 h-30 bg-gray-300 rounded hover:bg-gray-400 cursor-pointer flex items-center justify-center">
            <Image 
              src="/images/settings-icon.png" 
              alt="Settings" 
              width={24} 
              height={24} 
              className="object-contain"
            />
          </div>
        </Link>
      </div>
      
    </nav>
  )
}