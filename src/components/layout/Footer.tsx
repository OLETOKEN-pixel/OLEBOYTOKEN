import { Link } from 'react-router-dom';
import coinIcon from '@/assets/oleboy-coin.png';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#080808] border-t border-[#1f2937]">
      <div className="w-full flex justify-center pt-[41px] pb-[40px] px-[70px]">
        <div className="max-w-[1140px] w-full flex flex-col items-center">
          {/* Logo Row */}
          <div className="flex items-center gap-[8px] mb-[24px] opacity-80">
            <div className="w-[24px] h-[24px] bg-[#374151] rounded-[8px] flex items-center justify-center">
              <img src={coinIcon} alt="OleBoy Token" className="w-[24px] h-[24px] object-contain" />
            </div>
            <span className="font-teko font-bold text-[20px] text-white tracking-[1px]">
              OLEBOY TOKEN
            </span>
          </div>

          {/* Copyright */}
          <p className="text-center font-sans font-normal text-[14px] text-[#6b7280] mb-[24px]">
            {'\u00A9'} {currentYear} OleBoy Token. All rights reserved.
          </p>

          {/* Links Row */}
          <div className="flex items-center gap-[32px]">
            <Link
              to="/privacy"
              className="font-sans font-medium text-[14px] text-[#9CA3AF] hover:text-white transition-colors duration-200"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="font-sans font-medium text-[14px] text-[#9CA3AF] hover:text-white transition-colors duration-200"
            >
              Terms of Service
            </Link>
            <a
              href="/support"
              className="font-sans font-medium text-[14px] text-[#9CA3AF] hover:text-white transition-colors duration-200"
            >
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
